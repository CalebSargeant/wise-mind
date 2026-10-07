import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  HEADER_MISMATCH,
  INVALID_PARAMS,
  dispatch,
  LATEST_LEGACY,
  LEGACY_VERSIONS,
  SUPPORTED_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  decodeHeaderValue,
} from "../src/mcp.js";
import { ENDPOINT, MODERN, call, fakeEnv, modern, rpc, toolText } from "./harness.mjs";

/**
 * The transport, in both eras. A legacy client (2025-11-25 and earlier) opens with
 * `initialize`; a modern one (2026-07-28) sends `_meta` on every request and never
 * handshakes. The claim under test is that one stateless endpoint is a COMPLETE
 * implementation for both, which rests on the details asserted here.
 */

const env = () => fakeEnv();
const EXPECTED_TOOLS = [
  "wise_mind_crisis_support",
  "wise_mind_plan_conversation",
  "wise_mind_skill",
  "wise_mind_theirs_or_mine",
  "wise_mind_understand_emotion",
  "wise_mind_work_through_situation",
];
const EXPECTED_PROMPTS = ["check_in", "hard_moment", "prepare_conversation", "theirs_or_mine"];

// ── legacy: the initialize handshake ───────────────────────────────────────

test("legacy initialize answers 200 with no auth challenge, so no OAuth dance starts", async () => {
  const res = await rpc(worker, env(), ENDPOINT, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", clientInfo: { name: "test", version: "1" } },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("WWW-Authenticate"), null);
  assert.equal(res.body.result.protocolVersion, "2025-06-18");
  assert.equal(res.body.result.capabilities.tools.listChanged, false);
  assert.equal(res.body.result.capabilities.prompts.listChanged, false);
  assert.equal(res.body.result.serverInfo.name, "wise-mind");
  assert.ok(res.body.result.instructions.length > 80);
});

test("legacy initialize echoes every legacy version, and never negotiates a modern one", async () => {
  for (const asked of LEGACY_VERSIONS) {
    const res = await rpc(worker, env(), ENDPOINT, {
      jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: asked },
    });
    assert.equal(res.body.result.protocolVersion, asked);
  }
  // A modern version has no handshake, so through `initialize` it becomes the newest
  // revision that has one. So does anything unknown.
  for (const asked of [MODERN, "1999-01-01", undefined]) {
    const res = await rpc(worker, env(), ENDPOINT, {
      jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: asked },
    });
    assert.equal(res.body.result.protocolVersion, LATEST_LEGACY);
  }
});

test("serverInfo carries icons only to a client whose revision defines them", async () => {
  const old = await rpc(worker, env(), ENDPOINT, {
    jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" },
  });
  assert.equal(old.body.result.serverInfo.icons, undefined);
  const recent = await rpc(worker, env(), ENDPOINT, {
    jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" },
  });
  assert.ok(recent.body.result.serverInfo.icons.length);
});

test("no Mcp-Session-Id is ever issued, which is what makes statelessness complete", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.equal(res.headers.get("Mcp-Session-Id"), null);
});

test("a notification is answered with 202 and no body", async () => {
  for (const method of ["notifications/initialized", "notifications/cancelled"]) {
    const response = await worker.fetch(
      new Request(ENDPOINT, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", method }) }),
      env(),
    );
    assert.equal(response.status, 202);
    assert.equal(await response.text(), "");
  }
});

test("the front door and the crisis tool ask Claude Code to keep them loaded; the rest stay deferred", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  const loaded = res.body.result.tools.filter((t) => t._meta?.["anthropic/alwaysLoad"]).map((t) => t.name);
  assert.deepEqual(loaded, ["wise_mind_crisis_support", "wise_mind_work_through_situation"]);
});

test("legacy tools/list advertises exactly the read-only tools, with no modern fields", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(res.body.result.tools.map((t) => t.name), EXPECTED_TOOLS);
  assert.equal(res.body.result.resultType, undefined, "a legacy client was sent a modern field");
  for (const tool of res.body.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} is not marked read-only`);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description.length > 60, `${tool.name} has a thin description`);
  }
});

test("ping answers an empty result on the legacy path", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 9, method: "ping" });
  assert.deepEqual(res.body, { jsonrpc: "2.0", id: 9, result: {} });
});

test("a legacy request naming a version this server never negotiated is refused", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { "MCP-Protocol-Version": "2019-01-01" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, UNSUPPORTED_PROTOCOL_VERSION);
  assert.deepEqual(res.body.error.data.supported, SUPPORTED_VERSIONS);
});

test("a request with no version header at all is a 2025-03-26 client, and is served", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(res.status, 200);
});

// ── modern: 2026-07-28 ─────────────────────────────────────────────────────

test("server/discover answers with versions, capabilities, identity and a cache lifetime", async () => {
  const res = await modern(worker, env(), "server/discover");
  assert.equal(res.status, 200);
  const r = res.body.result;
  assert.equal(r.resultType, "complete");
  assert.deepEqual(r.supportedVersions, SUPPORTED_VERSIONS);
  assert.equal(r.supportedVersions[0], MODERN);
  assert.deepEqual(r.capabilities, { tools: { listChanged: false }, prompts: { listChanged: false } });
  assert.equal(r._meta["io.modelcontextprotocol/serverInfo"].name, "wise-mind");
  assert.ok(r.instructions.includes("wise_mind_work_through_situation"));
  assert.ok(r.instructions.includes("wise_mind_crisis_support"));
  assert.ok(r.ttlMs > 0);
  assert.equal(r.cacheScope, "public");
});

test("modern tools/list carries resultType and a public cache lifetime", async () => {
  const res = await modern(worker, env(), "tools/list");
  assert.equal(res.status, 200);
  assert.equal(res.body.result.resultType, "complete");
  assert.deepEqual(res.body.result.tools.map((t) => t.name), EXPECTED_TOOLS);
  assert.equal(res.body.result.cacheScope, "public");
});

test("modern tools/call works statelessly, with no handshake before it", async () => {
  const res = await modern(worker, env(), "tools/call", { name: "wise_mind_skill", arguments: { skill: "DEAR MAN" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.result.resultType, "complete");
  assert.equal(res.body.result.isError, false);
  assert.match(toolText(res), /DEAR MAN/);
});

test("a missing MCP-Protocol-Version header on a modern request is a HeaderMismatch", async () => {
  const res = await modern(worker, env(), "tools/list", {}, { headers: { "MCP-Protocol-Version": undefined } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, HEADER_MISMATCH);
});

test("a version header that disagrees with _meta is a HeaderMismatch, before the version is judged", async () => {
  const res = await modern(worker, env(), "tools/list", {}, { headers: { "MCP-Protocol-Version": "2025-06-18" } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, HEADER_MISMATCH);
});

test("an unsupported modern version gets UnsupportedProtocolVersionError naming what is supported", async () => {
  const res = await modern(worker, env(), "tools/list", {}, { version: "2099-01-01" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, UNSUPPORTED_PROTOCOL_VERSION);
  assert.deepEqual(res.body.error.data, { supported: SUPPORTED_VERSIONS, requested: "2099-01-01" });
});

test("Mcp-Method must be present and must match the body", async () => {
  const missing = await modern(worker, env(), "tools/list", {}, { headers: { "Mcp-Method": undefined } });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, HEADER_MISMATCH);
  const wrong = await modern(worker, env(), "tools/list", {}, { headers: { "Mcp-Method": "tools/call" } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error.code, HEADER_MISMATCH);
});

test("Mcp-Name must be present on tools/call and match the tool, after base64 decoding", async () => {
  const args = { name: "wise_mind_skill", arguments: { skill: "wise mind" } };
  const missing = await modern(worker, env(), "tools/call", args, { headers: { "Mcp-Name": undefined } });
  assert.equal(missing.body.error.code, HEADER_MISMATCH);
  const wrong = await modern(worker, env(), "tools/call", args, { headers: { "Mcp-Name": "wise_mind_understand_emotion" } });
  assert.equal(wrong.body.error.code, HEADER_MISMATCH);
  // The sentinel form of the same name is the same name.
  const encoded = `=?base64?${btoa("wise_mind_skill")}?=`;
  const ok = await modern(worker, env(), "tools/call", args, { headers: { "Mcp-Name": encoded } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.result.isError, false);
});

test("header values decode as the spec's sentinel describes, and garbage never matches", () => {
  assert.equal(decodeHeaderValue("wise_mind_skill"), "wise_mind_skill");
  assert.equal(decodeHeaderValue(`=?base64?${Buffer.from("Hello, 世界").toString("base64")}?=`), "Hello, 世界");
  assert.equal(decodeHeaderValue(null), null);
  assert.equal(typeof decodeHeaderValue("=?base64?%%%?="), "string", "a non-base64 sentinel is just a value");
  assert.equal(typeof decodeHeaderValue("=?base64?/w==?="), "symbol", "invalid UTF-8 must not decode to a string");
});

test("an unknown modern method is 404 with -32601, as the modern spec requires", async () => {
  const res = await modern(worker, env(), "resources/list");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, -32601);
});

test("an unknown tool on the modern path is a JSON-RPC error with HTTP 200, not a 400", async () => {
  // A 400 carrying plain -32602 would read to a dual-era client as "legacy server"
  // and send it off to re-handshake for nothing.
  const res = await modern(worker, env(), "tools/call", { name: "delete_everything", arguments: {} });
  assert.equal(res.status, 200);
  assert.equal(res.body.error.code, -32602);
});

test("initialize carrying modern _meta still selects the legacy handshake", async () => {
  const res = await modern(worker, env(), "initialize", { protocolVersion: "2025-06-18" });
  assert.equal(res.status, 200);
  assert.equal(res.body.result.protocolVersion, "2025-06-18");
});

test("a modern version header with no _meta behind it is a HeaderMismatch", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/list" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, HEADER_MISMATCH);
});

// ── both eras ──────────────────────────────────────────────────────────────

test("batching is refused rather than half-implemented", async () => {
  const res = await rpc(worker, env(), ENDPOINT, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, -32600);
});

test("a malformed body is a parse error, not a crash", async () => {
  const response = await worker.fetch(new Request(ENDPOINT, { method: "POST", body: "{not json" }), env());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, -32700);
});

test("an unknown legacy method is METHOD_NOT_FOUND and an unknown legacy tool is INVALID_PARAMS", async () => {
  const method = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "resources/list" });
  assert.equal(method.status, 404);
  assert.equal(method.body.error.code, -32601);
  const tool = await call(worker, env(), "delete_everything");
  assert.equal(tool.status, 200, "a legacy SDK client throws on a non-2xx POST and the model never sees the error");
  assert.equal(tool.body.error.code, -32602);
});

test("a missing required argument is an in-band isError, not a JSON-RPC error", async () => {
  for (const args of [{}, { emotion: "" }, { emotion: "   " }, { emotion: null }]) {
    const res = await call(worker, env(), "wise_mind_understand_emotion", args);
    assert.equal(res.status, 200);
    assert.equal(res.body.result.isError, true, `blank argument accepted: ${JSON.stringify(args)}`);
    assert.match(toolText(res), /missing required argument/);
  }
});

test("a handler that throws returns an isError result and keeps the endpoint usable", async () => {
  // Every real handler reads bundled content and has nothing to fail on, so the
  // failure is injected: a tool whose handler throws, dispatched directly.
  const tools = [{ name: "boom", title: "Boom", description: "throws", inputSchema: { type: "object" }, handler: async () => { throw new Error("handler is broken"); } }];
  const options = { tools, prompts: [], ctx: {}, server: { name: "t", title: "T", version: "0" }, headers: new Headers() };
  const res = await dispatch({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "boom" } }, options);
  assert.equal(res.status, 200);
  assert.equal(res.body.result.isError, true);
  assert.match(res.body.result.content[0].text, /handler is broken/);
  const after = await dispatch({ jsonrpc: "2.0", id: 2, method: "ping" }, options);
  assert.deepEqual(after.body.result, {});
});

test("a server with no prompts advertises no prompts capability and 404s prompts/list", async () => {
  const options = { tools: [], prompts: [], ctx: {}, server: { name: "t", title: "T", version: "0" }, headers: new Headers() };
  const init = await dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, options);
  assert.deepEqual(init.body.result.capabilities, { tools: { listChanged: false } });
  const list = await dispatch({ jsonrpc: "2.0", id: 2, method: "prompts/list" }, options);
  assert.equal(list.status, 404);
});

// ── prompts ────────────────────────────────────────────────────────────────

test("legacy prompts/list names every prompt, and none takes an argument", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "prompts/list" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.result.prompts.map((p) => p.name), EXPECTED_PROMPTS);
  assert.equal(res.body.result.resultType, undefined);
  for (const p of res.body.result.prompts) {
    assert.ok(p.description.length > 30, `${p.name} has a thin description`);
    // A prompt argument is free text sent to this server; the story stays in the conversation.
    assert.equal(p.arguments, undefined, `${p.name} takes arguments`);
  }
});

test("modern prompts/list carries resultType and a cache lifetime", async () => {
  const res = await modern(worker, env(), "prompts/list");
  assert.equal(res.status, 200);
  assert.equal(res.body.result.resultType, "complete");
  assert.deepEqual(res.body.result.prompts.map((p) => p.name), EXPECTED_PROMPTS);
  assert.equal(res.body.result.cacheScope, "public");
});

test("prompts/get renders a user message in both eras, and never echoes what a client sent", async () => {
  const legacy = await rpc(worker, env(), ENDPOINT, {
    jsonrpc: "2.0", id: 1, method: "prompts/get", params: { name: "theirs_or_mine", arguments: { situation: "my sister keeps criticising my parenting" } },
  });
  assert.equal(legacy.status, 200);
  const message = legacy.body.result.messages[0];
  assert.equal(message.role, "user");
  assert.equal(message.content.type, "text");
  assert.doesNotMatch(message.content.text, /my sister keeps criticising my parenting/);
  assert.match(message.content.text, /wise_mind_theirs_or_mine/);
  const mod = await modern(worker, env(), "prompts/get", { name: "hard_moment", arguments: {} });
  assert.equal(mod.status, 200);
  assert.equal(mod.body.result.resultType, "complete");
  assert.match(mod.body.result.messages[0].content.text, /wise_mind_work_through_situation/);
});

test("prompts/get with an unknown name is -32602 with HTTP 200 in both eras", async () => {
  const legacy = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "prompts/get", params: { name: "nope" } });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.error.code, INVALID_PARAMS);
  const mod = await modern(worker, env(), "prompts/get", { name: "nope" });
  assert.equal(mod.status, 200);
  assert.equal(mod.body.error.code, INVALID_PARAMS);
});

test("modern prompts/get needs an Mcp-Name header that matches the prompt", async () => {
  const missing = await modern(worker, env(), "prompts/get", { name: "check_in" }, { headers: { "Mcp-Name": undefined } });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, HEADER_MISMATCH);
  const wrong = await modern(worker, env(), "prompts/get", { name: "check_in" }, { headers: { "Mcp-Name": "theirs_or_mine" } });
  assert.equal(wrong.body.error.code, HEADER_MISMATCH);
});

test("undeclared or malformed prompt arguments are dropped, never trusted as structure", async () => {
  const res = await rpc(worker, env(), ENDPOINT, {
    jsonrpc: "2.0", id: 1, method: "prompts/get",
    params: { name: "theirs_or_mine", arguments: { situation: { toString: "x" }, extra: "y".repeat(10_000) } },
  });
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.body.result.messages[0].content.text, /yyyy/);
});

test("GET asking for an event stream is 405 with Allow, in both eras", async () => {
  const response = await worker.fetch(new Request(ENDPOINT, { headers: { Accept: "text/event-stream" } }), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST, OPTIONS");
});

test("DELETE is 405: there are no sessions to end", async () => {
  const response = await worker.fetch(new Request(ENDPOINT, { method: "DELETE" }), env());
  assert.equal(response.status, 405);
});

test("OPTIONS preflight succeeds and admits the modern request headers", async () => {
  const response = await worker.fetch(new Request(ENDPOINT, { method: "OPTIONS" }), env());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /\*/);
  assert.match(response.headers.get("Access-Control-Expose-Headers"), /MCP-Protocol-Version/);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
});

test("every response carries the security headers the Worker builds itself", async () => {
  const res = await rpc(worker, env(), ENDPOINT, { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.match(res.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.match(res.headers.get("Strict-Transport-Security"), /max-age=63072000/);
});

test("an oversized body is refused before it is parsed", async () => {
  const request = new Request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Length": String(1024 * 1024) },
    body: "x".repeat(100),
  });
  assert.equal((await worker.fetch(request, env())).status, 413);
});

test("a body with no Content-Length is cut off at 64 KiB while reading, not buffered whole", async () => {
  let pulls = 0;
  const chunk = new Uint8Array(16 * 1024).fill(120);
  const body = new ReadableStream({
    pull(controller) {
      pulls++;
      if (pulls > 128) controller.close(); // 2 MiB if nobody stops reading
      else controller.enqueue(chunk);
    },
  });
  const res = await worker.fetch(new Request(ENDPOINT, { method: "POST", body, duplex: "half" }), env());
  assert.equal(res.status, 413);
  assert.ok(pulls < 12, `read ${pulls} chunks before stopping`);
});

test("the size cap counts bytes, not characters", async () => {
  const text = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "€".repeat(30_000) } });
  assert.ok(text.length < 64 * 1024 && new TextEncoder().encode(text).length > 64 * 1024);
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } });
  const res = await worker.fetch(new Request(ENDPOINT, { method: "POST", body, duplex: "half" }), env());
  assert.equal(res.status, 413);
});

const saysNo = () => ({ calls: 0, async limit() { this.calls++; return { success: false }; } });

test("the burst brake fails OPEN when the limiter is unavailable", async () => {
  const broken = fakeEnv({ BURST: { limit: async () => { throw new Error("limiter unavailable"); } } });
  const res = await call(worker, broken, "wise_mind_skill", { skill: "stop" });
  assert.equal(res.status, 200);
  assert.equal(res.body.result.isError, false);
});

test("the brake never stands between a person and the handshake, the listings or crisis support", async () => {
  const limited = fakeEnv({ BURST: saysNo() });
  for (const method of ["initialize", "ping", "tools/list", "prompts/list"]) {
    assert.equal((await rpc(worker, limited, ENDPOINT, { jsonrpc: "2.0", id: 1, method })).status, 200, method);
  }
  const crisis = await call(worker, limited, "wise_mind_crisis_support", { country: "NL" });
  assert.equal(crisis.status, 200);
  assert.match(toolText(crisis), /113/);
  assert.equal(limited.BURST.calls, 0, "an unbraked request touched the limiter");
});

test("a call already on the safety route is never braked", async () => {
  const limited = fakeEnv({ BURST: saysNo() });
  for (const args of [{ situation_type: "other", safety: "suicide_or_self_harm", country: "NL" }, { situation_type: "controlling-partner", country: "NL" }, { situation_type: "other", topic: "I want to die" }]) {
    const res = await call(worker, limited, "wise_mind_work_through_situation", args);
    assert.equal(res.body.result.isError, false, JSON.stringify(args));
    assert.match(toolText(res), /# Safety first/);
  }
  assert.equal(limited.BURST.calls, 0);
});

test("a braked tool call is a readable result with the crisis directory; anything else is a 429", async () => {
  const limited = fakeEnv({ BURST: saysNo() });
  const tool = await call(worker, limited, "wise_mind_skill", { skill: "stop" });
  assert.equal(tool.status, 200);
  assert.equal(tool.body.result.isError, true);
  assert.match(toolText(tool), /findahelpline\.com/);
  const prompt = await rpc(worker, limited, ENDPOINT, { jsonrpc: "2.0", id: 2, method: "prompts/get", params: { name: "check_in" } });
  assert.equal(prompt.status, 429);
  assert.equal(prompt.headers.get("Retry-After"), "60");
  assert.equal(prompt.body.id, 2);
});

test("Anthropic's outbound range gets its own bucket; everyone else gets the per-IP one", async () => {
  const env = fakeEnv({ BURST: saysNo(), BURST_HOSTED: { calls: 0, async limit() { this.calls++; return { success: true }; } } });
  const hosted = await call(worker, env, "wise_mind_skill", { skill: "stop" }, { "CF-Connecting-IP": "160.79.105.10" });
  assert.equal(hosted.body.result.isError, false);
  assert.equal(env.BURST_HOSTED.calls, 1);
  const outside = await call(worker, env, "wise_mind_skill", { skill: "stop" }, { "CF-Connecting-IP": "160.79.112.1" });
  assert.equal(outside.body.result.isError, true);
  assert.equal(env.BURST.calls, 1);
});
