/**
 * Which requests this Worker answers at all.
 *
 * The same rule as mcp.calebsargeant.com: one public surface, on one hostname, at
 * one path, and everything else refused rather than guessed at.
 *
 * ── DENY BY DEFAULT, INCLUDING FOR HOSTNAMES ────────────────────────────────
 *
 * A Host this Worker has not been told about is refused. `workers_dev = false`
 * already means Cloudflare should never route one here; this is the belt to those
 * braces, so a second hostname added by accident gets a 404 rather than a copy of
 * the endpoint on a name nobody canonicalised.
 *
 * ── THE ENDPOINT IS `/`, AND ONLY `/` ───────────────────────────────────────
 *
 * The hostname IS the address: `https://wisemind.calebsargeant.com/`. A client
 * configured with `/mcp` gets a 404 whose body names the right URL, rather than a
 * second endpoint that has to be kept working.
 */

/** Is this a hostname this Worker serves anything on? */
export function servedHost(url, env) {
  const host = url.hostname.toLowerCase();
  return host === String(env.PUBLIC_HOST || "").toLowerCase() || isLocal(host);
}

/** True when this request is for the MCP endpoint itself. */
export function isEndpoint(url, env) {
  return servedHost(url, env) && url.pathname === "/";
}

/**
 * Localhost resolves so `wrangler dev` reaches the endpoint. It is not a security
 * decision: a request only arrives on 127.0.0.1 if it was made on the machine
 * running the dev server, and everything here is public anyway.
 */
function isLocal(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]"; // DevSkim: ignore DS162092
}
