import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SUPPORTED_VERSIONS } from "../src/mcp.js";
import { matchesIfNoneMatch } from "../src/discovery.js";
import { ENDPOINT, MODERN, fakeEnv } from "./harness.mjs";

/**
 * The pre-connection surface: the Server Card and the two catalogs. What matters is
 * that they agree with what the server says once connected, and that they carry the
 * media types, CORS and caching the Server Card extension asks for.
 */

const get = (path, headers = {}, method = "GET") =>
  worker.fetch(new Request(new URL(path, ENDPOINT), { method, headers }), fakeEnv());

test("the Server Card is served at <endpoint>/server-card with its media type, CORS and caching", async () => {
  const res = await get("/server-card", { Accept: "application/mcp-server-card+json" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/mcp-server-card+json");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(res.headers.get("Access-Control-Expose-Headers"), /ETag/);
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=3600");
  assert.match(res.headers.get("ETag"), /^"[0-9a-f]{32}"$/);
  const card = await res.json();
  assert.equal(card.$schema, "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
  assert.match(card.name, /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
  assert.ok(card.description.length >= 1 && card.description.length <= 100);
  assert.deepEqual(card.remotes, [{ type: "streamable-http", url: ENDPOINT, supportedProtocolVersions: SUPPORTED_VERSIONS }]);
  assert.equal("tools" in card, false, "the extension leaves primitives to runtime listing");
});

test("the card agrees with server/discover on version, title and protocol versions", async () => {
  const card = await (await get("/server-card")).json();
  const res = await worker.fetch(
    new Request(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": MODERN,
        "Mcp-Method": "server/discover",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": MODERN } },
      }),
    }),
    fakeEnv(),
  );
  const { result } = await res.json();
  const info = result._meta?.["io.modelcontextprotocol/serverInfo"] ?? result.serverInfo;
  assert.equal(card.version, info.version);
  assert.equal(card.title, info.title);
  assert.deepEqual(card.remotes[0].supportedProtocolVersions, result.supportedVersions);
});

test("the card names the public repository and the server's reverse-DNS name", async () => {
  const card = await (await get("/server-card")).json();
  assert.equal(card.name, "com.calebsargeant/wise-mind");
  assert.deepEqual(card.repository, { url: "https://github.com/CalebSargeant/wise-mind", source: "github" });
  assert.ok(card.icons.some((i) => i.mimeType === "image/png"));
});

test("the legacy per-domain path serves the same card", async () => {
  const [a, b] = await Promise.all([get("/server-card"), get("/.well-known/mcp/server-card.json")]);
  assert.equal(b.status, 200);
  assert.equal(b.headers.get("ETag"), a.headers.get("ETag"));
});

test("If-None-Match with the current ETag is a 304 with no body", async () => {
  const etag = (await get("/server-card")).headers.get("ETag");
  const res = await get("/server-card", { "If-None-Match": `W/${etag}, "other"` });
  assert.equal(res.status, 304);
  assert.equal(await res.text(), "");
});

test("the AI Catalog lists the card with a urn:air identifier and ARD's representative queries", async () => {
  const res = await get("/.well-known/ai-catalog.json");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/ai-catalog+json");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  const catalog = await res.json();
  assert.equal(catalog.specVersion, "1.0");
  assert.ok(catalog.host.displayName);
  assert.equal(catalog.entries.length, 1);
  const [entry] = catalog.entries;
  assert.match(entry.identifier, /^urn:air:calebsargeant\.com:mcp:[a-z0-9-]+$/);
  assert.equal(entry.type, "application/mcp-server-card+json");
  assert.equal(entry.url, `${ENDPOINT}server-card`);
  assert.ok(entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 6);
});

test("the API catalog is an RFC 9727 linkset that names itself, HEAD included", async () => {
  for (const method of ["GET", "HEAD"]) {
    const res = await get("/.well-known/api-catalog", {}, method);
    assert.equal(res.status, 200, method);
    assert.equal(res.headers.get("Content-Type"), 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"');
    assert.equal(res.headers.get("Link"), '</.well-known/api-catalog>; rel="api-catalog"');
  }
  const { linkset } = await (await get("/.well-known/api-catalog")).json();
  assert.deepEqual(linkset[0].item.map((l) => l.href), [ENDPOINT]);
  const api = linkset.find((l) => l.anchor === ENDPOINT);
  assert.equal(api["service-desc"][0].href, `${ENDPOINT}server-card`);
});

test("GET / advertises the card and both catalogs in a Link header, the 405 does not", async () => {
  for (const accept of ["text/html", "text/markdown"]) {
    const link = (await get("/", { Accept: accept })).headers.get("Link");
    assert.match(link, /<\/server-card>; rel="service-desc"/, accept);
    assert.match(link, /rel="api-catalog"/, accept);
    assert.match(link, /rel="ai-catalog"/, accept);
  }
  const refused = await get("/", { Accept: "text/event-stream" });
  assert.equal(refused.status, 405);
  assert.equal(refused.headers.get("Link"), null);
});

test("robots.txt points agent registries at the AI Catalog", async () => {
  assert.match(await (await get("/robots.txt")).text(), /^Agentmap: https:\/\/wisemind\.calebsargeant\.com\/\.well-known\/ai-catalog\.json$/m);
});

test("the discovery paths answer GET only; a POST there is still a 404", async () => {
  const res = await get("/server-card", { "Content-Type": "application/json" }, "POST");
  assert.equal(res.status, 404);
});

test("If-None-Match matching", () => {
  assert.equal(matchesIfNoneMatch(null, '"a"'), false);
  assert.equal(matchesIfNoneMatch("*", '"a"'), true);
  assert.equal(matchesIfNoneMatch('"b", W/"a"', '"a"'), true);
  assert.equal(matchesIfNoneMatch('"b"', '"a"'), false);
});
