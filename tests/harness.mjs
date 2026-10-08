/**
 * A fake environment and JSON-RPC helpers, so the Worker's own behaviour can be
 * tested with `node --test` and no Cloudflare account. The same doubles as
 * CalebSargeant/mcp's harness, without the bucket: this Worker reads nothing but
 * its own bundled content.
 */

import { MODERN_VERSIONS } from "../src/mcp.js";

export const ENDPOINT = "https://wisemind.calebsargeant.com/";
export const MODERN = MODERN_VERSIONS[0];

export function fakeEnv(overrides = {}) {
  return { PUBLIC_HOST: "wisemind.calebsargeant.com", ...overrides };
}

/** POST a JSON-RPC message and return { status, headers, body }. */
export async function rpc(worker, env, url, message, headers = {}) {
  const request = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(message),
  });
  const response = await worker.fetch(request, env);
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

/**
 * A MODERN (2026-07-28) request: `_meta` in the body, and the headers the transport
 * mirrors it into. `headers` can override or delete (`undefined`) any of them, so a
 * test that needs a bad request bends exactly one thing.
 */
export async function modern(worker, env, method, params = {}, { version = MODERN, headers = {}, id = 1 } = {}) {
  const base = {
    "MCP-Protocol-Version": version,
    "Mcp-Method": method,
    ...(method === "tools/call" || method === "prompts/get" ? { "Mcp-Name": params.name } : {}),
  };
  const merged = { ...base, ...headers };
  for (const [key, value] of Object.entries(merged)) if (value === undefined) delete merged[key];
  return rpc(
    worker,
    env,
    ENDPOINT,
    {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": version,
          "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
    merged,
  );
}

/** A legacy tools/call, the way a 2025-06-18 client sends it after its handshake. */
export async function call(worker, env, name, args = {}, headers = {}) {
  return rpc(
    worker,
    env,
    ENDPOINT,
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    { "MCP-Protocol-Version": "2025-06-18", ...headers },
  );
}

/** The text a tools/call returned, or throws if the call did not produce one. */
export function toolText(result) {
  const content = result.body?.result?.content;
  if (!Array.isArray(content)) throw new Error(`not a tool result: ${JSON.stringify(result.body)}`);
  return content.map((c) => c.text).join("\n");
}

/** Call a tool and return its text, asserting it was not an error. */
export async function run(worker, env, name, args = {}) {
  const res = await call(worker, env, name, args);
  if (res.body?.result?.isError) throw new Error(`${name} returned isError: ${toolText(res)}`);
  return toolText(res);
}
