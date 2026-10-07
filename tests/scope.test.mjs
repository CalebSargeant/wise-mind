import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { ENDPOINT, fakeEnv, rpc } from "./harness.mjs";

/** The hostname and path rules: one name, one path, everything else refused. */

const ping = { jsonrpc: "2.0", id: 1, method: "ping" };

test("the endpoint answers on its hostname at /", async () => {
  assert.equal((await rpc(worker, fakeEnv(), ENDPOINT, ping)).status, 200);
});

test("an unknown hostname is a 404, never a second copy of the endpoint", async () => {
  for (const host of ["https://wise-mind.calebsargeant.workers.dev/", "https://evil.example/", "https://mcp.calebsargeant.com/"]) {
    const res = await rpc(worker, fakeEnv(), host, ping);
    assert.equal(res.status, 404, host);
  }
});

test("/mcp is a 404 whose body names the real endpoint", async () => {
  const res = await rpc(worker, fakeEnv(), `${ENDPOINT}mcp`, ping);
  assert.equal(res.status, 404);
  assert.match(res.body.error_description, /no \/mcp path/);
  assert.match(res.body.error_description, /https:\/\/wisemind\.calebsargeant\.com\//);
});

test("localhost resolves, so wrangler dev reaches the endpoint", async () => {
  for (const host of ["http://localhost:8787/", "http://127.0.0.1:8787/"]) {
    assert.equal((await rpc(worker, fakeEnv(), host, ping)).status, 200, host);
  }
});

test("hostname matching ignores case", async () => {
  assert.equal((await rpc(worker, fakeEnv({ PUBLIC_HOST: "WiseMind.CalebSargeant.com" }), ENDPOINT, ping)).status, 200);
});
