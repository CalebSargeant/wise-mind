/**
 * JSON-RPC 2.0 for MCP over Streamable HTTP: the wire, and nothing else.
 *
 * CalebSargeant/mcp's src/mcp.js, with one addition: prompts (`prompts/list` and
 * `prompts/get`, both eras), which this server offers as slash commands for a
 * person who wants to start a skill themselves rather than wait for the model to
 * reach for a tool. A server with no prompts advertises no prompts capability, so
 * the rest of this file still behaves exactly as the original.
 *
 * ── TWO ERAS OF THE PROTOCOL, ONE ENDPOINT ──────────────────────────────────
 *
 * MCP revision 2026-07-28 removed the `initialize` handshake. A MODERN request
 * carries its protocol version in `params._meta["io.modelcontextprotocol/
 * protocolVersion"]`, mirrors it and the method into HTTP headers, and is served
 * statelessly on its own. A LEGACY client (2025-11-25 and earlier, which is still
 * most of what is installed) opens with `initialize` and expects the older result
 * shapes. The spec lets one endpoint serve both, and this one does, because an MCP
 * server that only half the clients in the wild can talk to is not "public" in any
 * useful sense:
 *
 *   `initialize`                        legacy handshake, whatever else it carries
 *   anything with a `_meta` version     modern: headers validated, served statelessly
 *   anything else                       legacy request after a legacy handshake
 *
 * Neither era needs state here, which is why serving both costs so little. The
 * legacy half never issues an `Mcp-Session-Id` (the official legacy client only
 * opens its GET stream `if session_id`, so it never asks for one), and the modern
 * half has no sessions to issue. Every request is answered from the request alone.
 *
 * ── WHAT A MODERN CLIENT IS HELD TO, AND WHY IT IS ENFORCED HERE ────────────
 *
 * The 2026-07-28 transport mirrors body fields into headers so intermediaries can
 * route without parsing JSON, and requires a server to REFUSE a request whose
 * headers and body disagree (400, `HeaderMismatch`). The reason is the one worth
 * knowing: a gateway deciding on the header while the server acts on the body is
 * two components with two sources of truth. Nothing on this Worker routes on a
 * header today, so the check protects nothing yet; it is enforced anyway so that a
 * client that gets it wrong finds out here and not against the next server it
 * talks to, and because "a conforming server" is a claim that should be true.
 *
 * ── STATUS CODES ARE PART OF THE PROTOCOL NOW ───────────────────────────────
 *
 * A client that speaks both eras decides which one THIS server speaks from the
 * first 4xx it gets: a recognised modern error body means "modern, fix the
 * request", anything else means "legacy, go and initialize". So a modern-path
 * failure that is not a transport fault (an unknown tool, say) is answered 200
 * with a JSON-RPC error, not 400: a 400 carrying the plain JSON-RPC -32602 would
 * read as "legacy server" and send a modern client off to re-handshake for
 * nothing. Unknown methods are 404 with -32601 on both paths, as the modern spec
 * requires and as the legacy half always did. (Unlike CalebSargeant/mcp, an
 * unknown tool or prompt on the LEGACY path is also 200: legacy SDK clients throw
 * on any non-2xx POST, which hides the JSON-RPC error from the model.)
 */

export const MODERN_VERSIONS = ["2026-07-28"];
export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
// Listed in both kinds of answer that name versions (UnsupportedProtocolVersionError
// and server/discover), newest first, legacy included: that is how a client that
// speaks both learns it may fall back to `initialize` rather than give up.
export const SUPPORTED_VERSIONS = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];
export const LATEST_LEGACY = LEGACY_VERSIONS[0];

// JSON-RPC 2.0 (https://www.jsonrpc.org/specification#error_object).
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
// MCP's protocol-defined sub-range (2026-07-28).
export const HEADER_MISMATCH = -32020;
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

/**
 * How long a modern client may cache `server/discover` and `tools/list`. The tool
 * set is decided at module load and only changes with a deploy, so an hour costs a
 * client that cached across a deploy at most an hour of an old tool description.
 * `public`, because nothing in either answer depends on who asked.
 */
const LIST_TTL_MS = 3_600_000;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const error = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: data === undefined ? { code, message } : { code, message, data },
});
const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
const answer = (status, body) => ({ status, body });

/**
 * A `tools/call` result: one text block, plus MCP's in-band error flag.
 *
 * A failing tool is reported HERE and not as a JSON-RPC error, per spec in both
 * eras. A JSON-RPC error is a protocol fault the client may swallow; `isError` is
 * a RESULT the model reads, so "that skill does not exist, here are the ones that
 * do" reaches the person who asked instead of surfacing as a broken connection.
 */
const textContent = (text, isError = false) => ({ content: [{ type: "text", text }], isError });

/**
 * Names in the schema's `required` list that are absent or blank. Blank counts as
 * missing on purpose: a model that has not been told a value will pass `""` rather
 * than omit the key, and the useful answer is the same sentence either way.
 */
function missingRequired(schema, args) {
  const required = Array.isArray(schema?.required) ? schema.required : [];
  return required.filter((name) => {
    const value = args[name];
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  });
}

function describe(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // Client hints keyed by vendor, e.g. Claude Code's `anthropic/alwaysLoad`,
    // which keeps a tool's definition in context instead of behind a search.
    ...(tool._meta ? { _meta: tool._meta } : {}),
    annotations: {
      title: tool.title,
      // EVERY tool here is read-only, and this is the machine-readable half of that
      // promise. The endpoint has no authentication, so a write verb on it would be
      // a verb anyone on the internet could call; there are none, and there will
      // not be.
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      // Nothing reaches outside the Worker's own bundled content, so a client may
      // retry freely and may call these to look around before it means anything.
      openWorldHint: false,
    },
  };
}

/** Sorted by name, so the listing is identical between calls (it is cached, and prompt-cached). */
const listing = (tools) => [...tools].sort((a, b) => a.name.localeCompare(b.name)).map(describe);

/** A prompt as `prompts/list` describes it: everything but the renderer. */
function describePrompt(prompt) {
  const out = { name: prompt.name, title: prompt.title, description: prompt.description };
  if (prompt.arguments?.length) {
    out.arguments = prompt.arguments.map(({ name, description, required }) => ({ name, description, required: Boolean(required) }));
  }
  return out;
}

const promptListing = (prompts = []) => [...prompts].sort((a, b) => a.name.localeCompare(b.name)).map(describePrompt);

/**
 * What this server can do. `prompts` appears only when there are prompts, so a
 * server built without them advertises exactly what the original did.
 */
function capabilities(prompts) {
  const caps = { tools: { listChanged: false } };
  if (prompts?.length) caps.prompts = { listChanged: false };
  return caps;
}

/**
 * Who this server says it is. `icons` and `websiteUrl` arrived in 2025-11-25, so
 * they go only to a client that negotiated a revision that defines them; an older
 * client with a strict schema should not be handed fields it has never heard of.
 */
function serverInfo(server, version) {
  const info = { name: server.name, title: server.title, version: server.version };
  if (version === LATEST_LEGACY || MODERN_VERSIONS.includes(version)) {
    if (server.websiteUrl) info.websiteUrl = server.websiteUrl;
    if (server.icons?.length) info.icons = server.icons;
  }
  return info;
}

function discoverResult(server, version, prompts) {
  return {
    resultType: "complete",
    supportedVersions: SUPPORTED_VERSIONS,
    // `listChanged` false is the truth: the tool and prompt sets are decided at
    // module load, so there is no notification a client would ever receive.
    capabilities: capabilities(prompts),
    _meta: { [META_SERVER_INFO]: serverInfo(server, version) },
    instructions: server.instructions,
    ttlMs: LIST_TTL_MS,
    cacheScope: "public",
  };
}

/**
 * Decode an `Mcp-Name` value. Names outside the header-safe character set are sent
 * as `=?base64?<UTF-8 as base64>?=`, and the spec requires the comparison with the
 * body to happen AFTER decoding. Undecodable returns a value that can never equal a
 * string, so a malformed header is a mismatch rather than an exception.
 */
export function decodeHeaderValue(value) {
  if (value === null) return null;
  const sentinel = /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(value);
  if (!sentinel) return value;
  try {
    const bytes = Uint8Array.from(atob(sentinel[1]), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return Symbol("undecodable");
  }
}

/** Run one tool. Shared by both eras; only the wrapping of the result differs. */
async function callTool(params, tools, ctx) {
  const name = params.name;
  const args = isObject(params.arguments) ? params.arguments : {};
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    // A PROTOCOL fault: the client asked for something never advertised. Unlike a
    // tool that ran and refused, which is an isError result the model reads.
    return { fault: `unknown tool: ${JSON.stringify(name)}` };
  }
  const missing = missingRequired(tool.inputSchema, args);
  if (missing.length) return textContent(`missing required argument(s): ${missing.join(", ")}`, true);
  try {
    return textContent(await tool.handler(args, ctx));
  } catch (err) {
    // A handler bug must not read as a dead server. Log it in full, hand the model a
    // short honest sentence, and keep the connection usable.
    console.error("tool failed", name, err?.stack || String(err));
    return textContent(`${name} failed: ${String(err?.message || err).slice(0, 300)}`, true);
  }
}

/**
 * Render one prompt. Unlike a tool, a prompt has no in-band error flag: the spec
 * answers an unknown name and a missing required argument with -32602, so both
 * come back as a `fault` and each era wraps it the way it wraps an unknown tool.
 * Prompt arguments are strings by definition; anything else is coerced, never
 * trusted as structure.
 */
function getPrompt(params, prompts = []) {
  const name = params.name;
  const prompt = prompts.find((p) => p.name === name);
  if (!prompt) return { fault: `unknown prompt: ${JSON.stringify(name)}`, code: INVALID_PARAMS };
  const raw = isObject(params.arguments) ? params.arguments : {};
  const declared = new Set((prompt.arguments || []).map((a) => a.name));
  const args = {};
  for (const [key, value] of Object.entries(raw)) {
    // Undeclared keys are dropped, never handed to render(): a prompt can only ever
    // see what it asked for.
    if (!declared.has(key)) continue;
    // Primitives only. An object here is a malformed client, and String() on a
    // JSON object can throw (`{"toString": "x"}` has no callable toString).
    if (["string", "number", "boolean"].includes(typeof value)) args[key] = String(value).slice(0, 2000);
  }
  const missing = (prompt.arguments || []).filter((a) => a.required && !String(args[a.name] || "").trim()).map((a) => a.name);
  if (missing.length) return { fault: `missing required argument(s): ${missing.join(", ")}`, code: INVALID_PARAMS };
  try {
    return { value: prompt.render(args) };
  } catch (err) {
    console.error("prompt failed", name, err?.stack || String(err));
    return { fault: `${name} failed to render`, code: INTERNAL_ERROR };
  }
}

/**
 * The modern path. Every check that can refuse runs before any tool does, in the
 * order the spec's own examples imply: headers that disagree with the body are a
 * malformed request whatever version they name, so HeaderMismatch comes before
 * UnsupportedProtocolVersion.
 */
async function modern(message, params, version, { tools, prompts, ctx, server, headers }) {
  const { id, method } = message;
  const mismatch = (text) => answer(400, error(id, HEADER_MISMATCH, `Header mismatch: ${text}`));

  const headerVersion = headers.get("MCP-Protocol-Version");
  if (headerVersion === null) return mismatch("the MCP-Protocol-Version header is required");
  if (headerVersion !== version) {
    return mismatch(`MCP-Protocol-Version header value '${headerVersion}' does not match body value '${version}'`);
  }
  if (!MODERN_VERSIONS.includes(version)) {
    return answer(
      400,
      error(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", {
        supported: SUPPORTED_VERSIONS,
        requested: version,
      }),
    );
  }
  const headerMethod = headers.get("Mcp-Method");
  if (headerMethod === null) return mismatch("the Mcp-Method header is required");
  if (headerMethod !== method) {
    return mismatch(`Mcp-Method header value '${headerMethod}' does not match body value '${method}'`);
  }
  // The transport requires Mcp-Name on the three methods that act on one named
  // thing; this server implements two of them.
  if (method === "tools/call" || method === "prompts/get") {
    const headerName = decodeHeaderValue(headers.get("Mcp-Name"));
    if (headerName === null) return mismatch(`the Mcp-Name header is required for ${method}`);
    if (headerName !== params.name) {
      return mismatch(`Mcp-Name header value does not match body value ${JSON.stringify(params.name)}`);
    }
  }
  const hasPrompts = Boolean(prompts?.length);

  switch (method) {
    case "server/discover":
      return answer(200, result(id, discoverResult(server, version, prompts)));
    case "ping":
      return answer(200, result(id, { resultType: "complete" }));
    case "tools/list":
      return answer(
        200,
        result(id, { resultType: "complete", tools: listing(tools), ttlMs: LIST_TTL_MS, cacheScope: "public" }),
      );
    case "tools/call": {
      const outcome = await callTool(params, tools, ctx);
      // 200, not 400: see "STATUS CODES ARE PART OF THE PROTOCOL NOW" above.
      if (outcome.fault) return answer(200, error(id, INVALID_PARAMS, outcome.fault));
      return answer(200, result(id, { resultType: "complete", ...outcome }));
    }
    case "prompts/list":
      if (!hasPrompts) break;
      return answer(
        200,
        result(id, { resultType: "complete", prompts: promptListing(prompts), ttlMs: LIST_TTL_MS, cacheScope: "public" }),
      );
    case "prompts/get": {
      if (!hasPrompts) break;
      const outcome = getPrompt(params, prompts);
      // 200 for the same reason as an unknown tool.
      if (outcome.fault) return answer(200, error(id, outcome.code, outcome.fault));
      return answer(200, result(id, { resultType: "complete", ...outcome.value }));
    }
  }
  // Anything not answered above, including prompts on a server that has none.
  return answer(404, error(id, METHOD_NOT_FOUND, `unsupported method: ${method}`));
}

/** The legacy path: MagmaMoose/mcp's behaviour, unchanged apart from the versions it knows and prompts. */
async function legacy(message, params, { tools, prompts, ctx, server, headers }) {
  const { id, method } = message;

  if (method === "initialize") {
    // Echo the client's version when it is one of ours. The client STORES the
    // negotiated value and sends it as MCP-Protocol-Version on every later request,
    // so answering with our own latest when theirs was fine would silently upgrade
    // them. An unknown one, including a modern version sent through the legacy
    // handshake, gets the newest revision that HAS a handshake.
    const asked = params.protocolVersion;
    const negotiated = LEGACY_VERSIONS.includes(asked) ? asked : LATEST_LEGACY;
    return answer(
      200,
      result(id, {
        protocolVersion: negotiated,
        capabilities: capabilities(prompts),
        serverInfo: serverInfo(server, negotiated),
        instructions: server.instructions,
      }),
    );
  }

  // After the handshake a 2025-06-18+ client names its version in a header on every
  // request. One this server never negotiated is refused as the legacy spec says;
  // a MODERN version with no `_meta` behind it is a modern request with the body
  // half missing. No header at all is a 2025-03-26 client, which never sent one.
  const headerVersion = headers.get("MCP-Protocol-Version");
  if (headerVersion !== null && !LEGACY_VERSIONS.includes(headerVersion)) {
    if (MODERN_VERSIONS.includes(headerVersion)) {
      return answer(
        400,
        error(id, HEADER_MISMATCH, `Header mismatch: MCP-Protocol-Version is '${headerVersion}' but the body carries no _meta protocol version`),
      );
    }
    return answer(
      400,
      error(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", {
        supported: SUPPORTED_VERSIONS,
        requested: headerVersion,
      }),
    );
  }

  switch (method) {
    case "ping":
      return answer(200, result(id, {}));
    case "tools/list":
      return answer(200, result(id, { tools: listing(tools) }));
    case "tools/call": {
      const outcome = await callTool(params, tools, ctx);
      // 200 with the JSON-RPC error, as on the modern path. A legacy SDK client throws
      // a transport error on any non-2xx POST, so a 400 here would turn a misspelt
      // tool name into "server unreachable" instead of an error the model can read.
      if (outcome.fault) return answer(200, error(id, INVALID_PARAMS, outcome.fault));
      return answer(200, result(id, outcome));
    }
    case "prompts/list":
      if (!prompts?.length) break;
      return answer(200, result(id, { prompts: promptListing(prompts) }));
    case "prompts/get": {
      if (!prompts?.length) break;
      const outcome = getPrompt(params, prompts);
      if (outcome.fault) return answer(200, error(id, outcome.code, outcome.fault));
      return answer(200, result(id, outcome.value));
    }
    case "server/discover":
      // Only a modern client should ask, and it would carry `_meta`. Answering a bare
      // one anyway costs nothing and tells whoever is probing what they need to know.
      return answer(200, result(id, discoverResult(server, LATEST_LEGACY, prompts)));
  }
  // Anything not answered above, including prompts on a server that has none.
  return answer(404, error(id, METHOD_NOT_FOUND, `unsupported method: ${method}`));
}

/**
 * Handle one decoded JSON-RPC message. Never throws.
 *
 * Returns `{ body, status }`; `body === null` means no body, which the HTTP layer
 * turns into 202 Accepted. That is what a NOTIFICATION gets in both eras: the server
 * must not answer one, and neither client reads a body on 202. The modern revision
 * defines no client-to-server notifications over HTTP at all, so in practice these
 * are a legacy client's `notifications/initialized`, acked and dropped.
 */
export async function dispatch(message, options) {
  if (Array.isArray(message)) {
    // Batching was removed in 2025-06-18 and has not come back. Accepting it would
    // mean inventing a response shape no client asks for.
    return answer(400, error(null, INVALID_REQUEST, "JSON-RPC batching is not supported"));
  }
  if (!isObject(message)) return answer(400, error(null, INVALID_REQUEST, "expected a JSON-RPC object"));

  const { method, id } = message;
  const params = isObject(message.params) ? message.params : {};
  const isNotification = !("id" in message);

  if (typeof method !== "string" || !method) {
    if (isNotification) return answer(202, null);
    return answer(400, error(id, INVALID_REQUEST, "missing method"));
  }
  if (isNotification) return answer(202, null);

  const meta = isObject(params._meta) ? params._meta : {};
  if (method !== "initialize" && META_VERSION in meta) {
    return modern(message, params, meta[META_VERSION], options);
  }
  return legacy(message, params, options);
}
