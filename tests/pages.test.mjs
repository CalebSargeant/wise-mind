import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { TOOLS } from "../src/tools.js";
import { PROMPTS } from "../src/prompts.js";
import { securityExpiry, securityTxt } from "../src/pages.js";
import { ENDPOINT, fakeEnv } from "./harness.mjs";

/**
 * The non-JSON-RPC surface: what a person, a crawler and a security scanner get.
 */

const get = (path, accept, method = "GET") =>
  worker.fetch(new Request(new URL(path, ENDPOINT), { method, headers: accept ? { Accept: accept } : {} }), fakeEnv());

test("a browser gets a script-free page the zone can neither inject analytics into nor run them on", async () => {
  const res = await get("/", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type"), /^text\/html; charset=utf-8/);
  const csp = res.headers.get("Content-Security-Policy");
  assert.match(csp, /default-src 'none'/);
  // /privacy promises no analytics: no-transform stops the beacon being injected,
  // and a CSP with no script-src stops it running if it is.
  assert.doesNotMatch(csp, /script-src|connect-src/);
  assert.match(res.headers.get("Cache-Control"), /\bno-transform\b/);
  const html = await res.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/wisemind\.calebsargeant\.com\/">/);
  assert.match(html, /claude mcp add --transport http wise-mind https:\/\/wisemind\.calebsargeant\.com\//);
  assert.doesNotMatch(html, /<script(?! type="application\/ld\+json")/, "the page carries executable script");
  for (const tool of TOOLS) assert.match(html, new RegExp(tool.name), `the page does not list ${tool.name}`);
  for (const prompt of PROMPTS) assert.match(html, new RegExp(prompt.name), `the page does not list ${prompt.name}`);
  // A person who lands here in crisis is pointed at help before anything else.
  assert.ok(html.indexOf("findahelpline.com") < html.indexOf("<h2>"), "the crisis line is not above the fold");
  assert.match(html, /Not affiliated with/);
  // The JSON-LD attaches the endpoint to the Person calebsargeant.com already publishes.
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);
  assert.equal(ld.provider["@id"], "https://calebsargeant.com/#person");
});

test("anything else opening the endpoint gets markdown", async () => {
  for (const accept of [undefined, "*/*", "text/markdown", "text/plain"]) {
    const res = await get("/", accept);
    assert.equal(res.status, 200, `Accept: ${accept}`);
    assert.match(res.headers.get("Content-Type"), /^text\/markdown/);
    assert.match(await res.text(), /^# Wise Mind MCP server/);
  }
});

test("an event-stream request is refused before any page is considered", async () => {
  // A legacy client that got 200 here would try to parse the page as a stream.
  const res = await get("/", "text/html, text/event-stream");
  assert.equal(res.status, 405);
});

test("llms.txt describes the live tools and prompts, the crisis pointer and the source", async () => {
  const res = await get("/llms.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type"), /^text\/plain; charset=utf-8/);
  const body = await res.text();
  assert.match(body, /^# Wise Mind MCP server\n\n> /, "not the llms.txt shape: H1 then a blockquote");
  for (const tool of TOOLS) assert.match(body, new RegExp(`\`${tool.name}\``));
  for (const prompt of PROMPTS) assert.match(body, new RegExp(`\`${prompt.name}\``));
  assert.match(body, /findahelpline\.com/);
  assert.match(body, /github\.com\/CalebSargeant\/wise-mind/);
  assert.match(body, /There is no `\/mcp` path/);
});

test("robots.txt allows everything and states the content signals", async () => {
  const body = await (await get("/robots.txt")).text();
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Allow: \/$/m);
  assert.match(body, /^Content-Signal: search=yes, ai-input=yes, ai-train=yes$/m);
  assert.doesNotMatch(body, /Disallow/);
});

test("security.txt satisfies RFC 9116: Contact, an Expires under a year out, and a Canonical", async () => {
  const res = await get("/.well-known/security.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type"), /^text\/plain; charset=utf-8/);
  const body = await res.text();
  assert.match(body, /^Contact: mailto:contact@calebsargeant\.com$/m);
  assert.match(body, /^Canonical: https:\/\/wisemind\.calebsargeant\.com\/\.well-known\/security\.txt$/m);
  const expires = new Date(/^Expires: (.+)$/m.exec(body)[1]);
  const days = (expires - Date.now()) / 86_400_000;
  assert.ok(days > 140 && days < 365, `Expires is ${days.toFixed(0)} days out`);
});

test("security.txt's Expires is stable within a month and always in the future", () => {
  assert.equal(securityExpiry(new Date("2026-09-01T00:00:00Z")), securityExpiry(new Date("2026-09-30T23:59:59Z")));
  assert.equal(securityExpiry(new Date("2026-09-22T12:00:00Z")), "2027-03-01T00:00:00.000Z");
  // Across a year boundary, where month arithmetic is easiest to get wrong.
  assert.equal(securityExpiry(new Date("2026-11-15T00:00:00Z")), "2027-05-01T00:00:00.000Z");
  assert.match(securityTxt(new Date("2026-09-22T00:00:00Z")), /Expires: 2027-03-01T00:00:00.000Z/);
});

test("HEAD answers like GET without a body", async () => {
  const res = await get("/llms.txt", undefined, "HEAD");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "");
});

test("an unknown path is a 404 that names the endpoint", async () => {
  const res = await get("/wp-login.php");
  assert.equal(res.status, 404);
  assert.match((await res.json()).error_description, /https:\/\/wisemind\.calebsargeant\.com\//);
});

test("every page carries the security headers too", async () => {
  for (const path of ["/", "/llms.txt", "/robots.txt", "/.well-known/security.txt", "/nope"]) {
    const res = await get(path, "text/html");
    assert.match(res.headers.get("Strict-Transport-Security"), /max-age=63072000; includeSubDomains/, path);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff", path);
    assert.equal(res.headers.get("X-Frame-Options"), "DENY", path);
  }
});

test("the icon is served as SVG and as a PNG that really is a PNG", async () => {
  const svg = await get("/icon.svg");
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get("Content-Type"), /^image\/svg\+xml/);
  assert.match(await svg.text(), /^<svg /);
  const png = await get("/icon.png");
  assert.equal(png.status, 200);
  assert.equal(png.headers.get("Content-Type"), "image/png");
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});
