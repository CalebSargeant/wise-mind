import { dispatch, PARSE_ERROR } from "./mcp.js";
import { TOOLS } from "./tools.js";
import { PROMPTS } from "./prompts.js";
import { SERVER, ENDPOINT } from "./server.js";
import { matchSituations, safetyLevel, screen, situationById, str } from "./guide.js";
import { isEndpoint, servedHost } from "./scope.js";
import { ICON_PNG, ICON_SVG, PRIVACY_TXT, ROBOTS_TXT, guideHtml, guideMarkdown, securityTxt } from "./pages.js";
import {
  AI_CATALOG_PATH,
  AI_CATALOG_TYPE,
  API_CATALOG_PATH,
  API_CATALOG_TYPE,
  DISCOVERY_LINKS,
  LEGACY_SERVER_CARD_PATH,
  SERVER_CARD_PATH,
  SERVER_CARD_TYPE,
  aiCatalog,
  apiCatalog,
  etagOf,
  matchesIfNoneMatch,
  serverCard,
} from "./discovery.js";

/**
 * wisemind.calebsargeant.com: a public, read-only MCP server that hands an
 * assistant DBT skills and the Let Them / Let Me idea, so it can help a person
 * through a hard moment practically as well as emotionally.
 *
 * The protocol layer (mcp.js) is mcp.calebsargeant.com's, unchanged apart from
 * prompts, and so is the shape of this file. What differs is the content: there is
 * no corpus and no bucket. Every skill, playbook and crisis line is a module under
 * src/content/, bundled at deploy, so nothing on the request path waits on storage
 * and nothing a client reads can drift from the reviewed commit.
 *
 * ── THE ORDER OF THE CHECKS ─────────────────────────────────────────────────
 *
 *   1. hostname             in memory; an unknown host is refused, not guessed at
 *   2. path and method      string compares; the endpoint is POST /
 *   3. size cap             a declared Content-Length first, then counted bytes
 *                           while reading, so an undeclared body stops at 64 KiB
 *   4. parse                JSON, or a parse error
 *   5. burst brake          per-PoP counter, fails open; see "THE BRAKE" below
 *   6. dispatch
 *
 * ── THE BRAKE NEVER STANDS BETWEEN A PERSON AND A CRISIS LINE ───────────────
 *
 * The brake is keyed on the client IP, and every claude.ai, desktop and mobile
 * user reaches this server from Anthropic's one outbound range, so those users
 * share a counter. Three things follow. Anthropic's range gets its own, much
 * larger bucket (BURST_HOSTED), so a few hundred people in one Cloudflare
 * location are not one client. The handshake, the listings, notifications and
 * every call to wise_mind_crisis_support are never braked at all. And a braked
 * tool call is answered as a tool result (isError, with the crisis directory in
 * it), not as an HTTP 429 a client would surface as a broken server.
 *
 * ── WHAT A PERSON TELLS THEIR ASSISTANT IS NEVER WRITTEN DOWN HERE ──────────
 *
 * Tool arguments are categories (a situation type, emotion families, a number),
 * chosen so a person's story never has to leave their conversation. Even so,
 * nothing in this Worker logs, stores or forwards them: there is no storage
 * binding, no outbound fetch, invocation logs are off (wrangler.toml), and the
 * console calls (a handler that threw, in mcp.js) log the name and the stack,
 * never the arguments. /privacy says the same thing to a person.
 *
 * There is no auth step, for the reason mcp.calebsargeant.com gives: a 401 anywhere
 * in an MCP handshake sends a client looking for an authorization server that does
 * not exist, and nothing here is anybody's to protect.
 */

const SECURITY_HEADERS = {
  // Worker-built responses get no `_headers` treatment, so every response is
  // assembled with these. HSTS matches calebsargeant.com's own.
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Cache-Control": "no-store",
};

/**
 * The one page with markup: inline styles and its own icon, and no script at all.
 * Unlike mcp.calebsargeant.com, this page does NOT admit the zone's Web Analytics
 * beacon: /privacy promises no analytics, so the page is sent with no-transform
 * (which stops the zone injecting the beacon) and a CSP with no script-src (which
 * stops it running if it is injected anyway). Belt and braces, so the promise holds
 * by construction rather than by a dashboard setting.
 */
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * CORS is `*`: MCP clients include browser-based ones, nothing here takes a cookie,
 * and `Access-Control-Allow-Credentials` is absent, which is what makes `*` safe.
 * Request headers are a wildcard because the 2026-07-28 transport mirrors
 * `Mcp-Param-*` values into headers no server can list in advance, plus
 * `Authorization`, which a wildcard never covers and a client may send anyway.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, *",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

/** A request body larger than this is refused before it is parsed. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Anthropic's published outbound range, which every MCP connector call from the
 * Claude apps comes from (platform.claude.com/docs/en/api/ip-addresses, checked
 * 2026-10-07). IPv4 only, because that is all Anthropic lists for outbound.
 */
const HOSTED_EGRESS_V4 = [["160.79.104.0", 21]];
const v4 = (ip) => ip.split(".").reduce((n, o) => ((n << 8) + (Number(o) & 255)) >>> 0, 0);
const inV4Cidr = (ip, [base, bits]) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ((v4(ip) ^ v4(base)) >>> (32 - bits)) === 0;
export const isHostedEgress = (ip) => HOSTED_EGRESS_V4.some((cidr) => inV4Cidr(ip, cidr));

/** Requests the brake never counts. See "THE BRAKE NEVER STANDS..." above. */
const UNBRAKED_METHODS = new Set(["initialize", "ping", "server/discover", "tools/list", "prompts/list"]);

/**
 * A tool call already on the safety route: flagged by the assistant, a safety
 * playbook (named, or matched from the topic the way the handler matches it), or
 * risk in any free text a handler screens (topic, emotion, skill). Its answer is
 * crisis guidance, so it is never braked either. Uses the handlers' own bounds,
 * so the screen never runs over a whole 64 KiB body.
 */
const onSafetyRoute = (args) => {
  if (!args || typeof args !== "object") return false;
  const topic = str(args.topic, 120);
  const playbook = situationById(str(args.situation_type, 60)) || matchSituations(topic)[0]?.situation;
  return (
    safetyLevel(args.safety) !== "none" ||
    Boolean(playbook?.safety) ||
    [topic, str(args.emotion, 60), str(args.skill, 120)].some((text) => screen(text) !== "none")
  );
};

const unbraked = (message) =>
  !message || typeof message !== "object" || Array.isArray(message) || // dispatch refuses these anyway
  !("id" in message) || // a notification
  UNBRAKED_METHODS.has(message.method) ||
  (message.method === "tools/call" && (message.params?.name === "wise_mind_crisis_support" || onSafetyRoute(message.params?.arguments)));

/** A braked tool call, answered as a result the model can read and pass on. */
const BUSY =
  "Wise Mind is busy right now; try again in a minute. If anyone is in danger, call the local emergency number, " +
  "or find a free crisis line at https://findahelpline.com/ (wise_mind_crisis_support is never rate limited).";

/**
 * The body as UTF-8, or null once it passes `limit` BYTES. Counted while reading,
 * so a chunked body with no Content-Length is cut off at the limit instead of being
 * buffered whole, and multi-byte text is measured in bytes, not characters.
 */
async function readCapped(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const json = (body, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { ...SECURITY_HEADERS, ...CORS, ...extra } });

const empty = (status, extra = {}) => new Response(null, { status, headers: { ...SECURITY_HEADERS, ...CORS, ...extra } });

/** Text with a short browser cache: these change with a deploy, not with a request. */
const text = (body, type, method, extra = {}) =>
  new Response(method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      ...CORS,
      "Content-Type": type.includes("charset") || type.startsWith("image/png") ? type : `${type}; charset=utf-8`,
      "Cache-Control": "public, max-age=3600",
      ...extra,
    },
  });

/**
 * A discovery document (see discovery.js): public metadata that any origin may read
 * and cache for an hour, with an ETag so a client re-checking it gets a 304.
 */
async function discoveryDoc(request, value, type, extra = {}) {
  const body = JSON.stringify(value, null, 2);
  const etag = await etagOf(body);
  const headers = {
    ...SECURITY_HEADERS,
    ...CORS,
    "Content-Type": type,
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Expose-Headers": "ETag",
    ETag: etag,
    ...extra,
  };
  if (matchesIfNoneMatch(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}

const notFound = (url) =>
  json(
    {
      error: "not_found",
      error_description:
        url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")
          ? `There is no /mcp path. The MCP endpoint is ${ENDPOINT}`
          : `Nothing at ${url.pathname}. The MCP endpoint is ${ENDPOINT} and ${ENDPOINT}llms.txt describes it.`,
    },
    404,
  );

/**
 * GET / for something that is not an MCP client. Anything that lists
 * `text/event-stream` is a client asking for the server-to-client stream and gets
 * the 405 both eras prescribe; that test comes FIRST, because a legacy client that
 * got a 200 here would try to parse the page as a stream. Browsers get the HTML,
 * everything else the markdown.
 */
function guide(request) {
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  if (accept.includes("text/event-stream")) {
    return json(
      { error: "method_not_allowed", error_description: `this server is stateless; POST JSON-RPC to ${ENDPOINT}` },
      405,
      { Allow: "POST, OPTIONS" },
    );
  }
  if (accept.includes("text/html")) {
    return text(guideHtml(TOOLS, PROMPTS), "text/html", request.method, {
      "Content-Security-Policy": PAGE_CSP,
      "Cache-Control": "public, max-age=3600, no-transform",
      Link: DISCOVERY_LINKS,
      Vary: "Accept",
    });
  }
  return text(guideMarkdown(TOOLS, PROMPTS), "text/markdown", request.method, { Link: DISCOVERY_LINKS, Vary: "Accept" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return empty(204);

    // 1. Hostname.
    if (!servedHost(url, env)) {
      return json({ error: "not_found", error_description: `no MCP endpoint at ${url.host}` }, 404);
    }

    // 2. Path and method.
    const endpoint = isEndpoint(url, env);
    if (request.method === "GET" || request.method === "HEAD") {
      if (endpoint) return guide(request);
      switch (url.pathname) {
        case "/llms.txt":
          return text(guideMarkdown(TOOLS, PROMPTS), "text/plain", request.method);
        case "/robots.txt":
          return text(ROBOTS_TXT, "text/plain", request.method);
        case "/privacy":
          return text(PRIVACY_TXT, "text/plain", request.method);
        case "/.well-known/security.txt":
          return text(securityTxt(new Date()), "text/plain", request.method);
        case "/icon.svg":
          return text(ICON_SVG, "image/svg+xml", request.method, { "Cache-Control": "public, max-age=86400" });
        case "/icon.png":
          return new Response(request.method === "HEAD" ? null : ICON_PNG, {
            status: 200,
            headers: { ...SECURITY_HEADERS, ...CORS, "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
          });
        case SERVER_CARD_PATH:
        case LEGACY_SERVER_CARD_PATH:
          return discoveryDoc(request, serverCard(SERVER), SERVER_CARD_TYPE);
        case AI_CATALOG_PATH:
          return discoveryDoc(request, aiCatalog(SERVER), AI_CATALOG_TYPE);
        case API_CATALOG_PATH:
          // RFC 9727 wants the catalog to name itself in a Link, HEAD included.
          return discoveryDoc(request, apiCatalog(), API_CATALOG_TYPE, { Link: `<${API_CATALOG_PATH}>; rel="api-catalog"` });
        default:
          return notFound(url);
      }
    }
    if (!endpoint) return notFound(url);
    if (request.method !== "POST") {
      // DELETE included: it ended a session in the legacy transport, and there are
      // no sessions here to end.
      return json({ error: "method_not_allowed" }, 405, { Allow: "POST, OPTIONS" });
    }

    // 3. Size: the declared length first, then the bytes actually read.
    const declared = Number(request.headers.get("Content-Length") || 0);
    if (declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

    // 4. Parse.
    let message;
    try {
      const raw = await readCapped(request, MAX_BODY_BYTES);
      if (raw === null) return json({ error: "payload_too_large" }, 413);
      message = JSON.parse(raw);
    } catch {
      return json({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "parse error" } }, 400);
    }

    // 5. Burst. Fails OPEN by design: a brake, not a ceiling, over read-only verbs.
    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const brake = isHostedEgress(ip) ? env.BURST_HOSTED : env.BURST;
    if (brake && !unbraked(message)) {
      try {
        const { success } = await brake.limit({ key: ip });
        if (!success) {
          if (message.method === "tools/call") {
            const modern = Boolean(message.params?._meta?.["io.modelcontextprotocol/protocolVersion"]);
            const result = { ...(modern ? { resultType: "complete" } : {}), content: [{ type: "text", text: BUSY }], isError: true };
            return json({ jsonrpc: "2.0", id: message.id ?? null, result });
          }
          return json({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32000, message: "rate limited; retry in 60 seconds" } }, 429, { "Retry-After": "60" });
        }
      } catch {
        /* limiter unavailable: continue */
      }
    }

    // 6. Dispatch.
    const { body, status } = await dispatch(message, {
      tools: TOOLS,
      prompts: PROMPTS,
      ctx: { env },
      server: SERVER,
      headers: request.headers,
    });
    // `body === null` is a notification, which the server must not answer.
    return body === null ? empty(status) : json(body, status);
  },
};
