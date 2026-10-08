/**
 * What an agent can learn about this server before it connects.
 *
 * Runtime discovery (`server/discover`, `initialize`) only works once a client
 * already knows where the endpoint is. These documents are for the step before:
 * a registry crawling domains, a client pointed at this hostname, or a scanner
 * such as isitagentready.com (the one behind Cloudflare's Agent Readiness page).
 *
 *   GET /server-card                    the MCP Server Card, at the location the
 *                                       Server Card extension reserves:
 *                                       <streamable-http-url>/server-card
 *   GET /.well-known/mcp/server-card.json
 *                                       the same card, at the per-domain path from
 *                                       the extension's first draft (SEP-1649),
 *                                       which scanners still probe
 *   GET /.well-known/ai-catalog.json    an AI Catalog listing the card, which is how
 *                                       the extension does domain-level discovery
 *   GET /.well-known/api-catalog        the same pointer as an RFC 9727 linkset
 *
 * All four are built from the constants the protocol answers use (SERVER in
 * index.js, SUPPORTED_VERSIONS in mcp.js), so a card cannot claim a version or a
 * name that `server/discover` would contradict, which is the one consistency rule
 * the extension asks for.
 *
 *
 * Specs: modelcontextprotocol.io SEP-2127 and the experimental-ext-server-card
 * repository (schema.ts, docs/discovery.md); github.com/Agent-Card/ai-catalog;
 * agenticresourcediscovery.org for `representativeQueries`; RFC 9727 and RFC 9264.
 */

import { SUPPORTED_VERSIONS } from "./mcp.js";
import { ENDPOINT, REPOSITORY } from "./server.js";

export const SERVER_CARD_PATH = "/server-card";
export const LEGACY_SERVER_CARD_PATH = "/.well-known/mcp/server-card.json";
export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";
export const API_CATALOG_PATH = "/.well-known/api-catalog";

export const SERVER_CARD_TYPE = "application/mcp-server-card+json";
export const AI_CATALOG_TYPE = "application/ai-catalog+json";
export const API_CATALOG_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

const CARD_URL = `${ENDPOINT}server-card`;

/**
 * At most 100 characters: the schema's limit, which is also why this is not
 * SERVER.instructions (that is written for a model that has already connected).
 */
const DESCRIPTION = "DBT skills plus Let Them / Let Me, for hard moments with people. Public, read-only.";

/**
 * The Link header on GET /, so an agent reading only headers still finds all of it.
 * `service-desc` (RFC 8631) is the machine-readable description of the service at
 * the context URL, which is what a Server Card is for this endpoint.
 */
export const DISCOVERY_LINKS = [
  `<${SERVER_CARD_PATH}>; rel="service-desc"; type="${SERVER_CARD_TYPE}"`,
  `<${API_CATALOG_PATH}>; rel="api-catalog"`,
  `<${AI_CATALOG_PATH}>; rel="ai-catalog"; type="${AI_CATALOG_TYPE}"`,
  '</llms.txt>; rel="describedby"; type="text/plain"',
].join(", ");

/** The Server Card: identity, the one remote, and the protocol versions it speaks. No tools, by design of the extension. */
export function serverCard(server) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    // Reverse-DNS, as the schema requires. serverInfo.name ("wise-mind") is the
    // same server's short name; the card's is namespaced by the domain.
    name: "com.calebsargeant/wise-mind",
    version: server.version,
    description: DESCRIPTION,
    title: server.title,
    websiteUrl: server.websiteUrl,
    icons: server.icons,
    // The repository is public, so the card names it: the content a client is
    // handed is reviewable line by line, which matters more for this server than for
    // most.
    repository: { url: REPOSITORY, source: "github" },
    remotes: [{ type: "streamable-http", url: ENDPOINT, supportedProtocolVersions: SUPPORTED_VERSIONS }],
  };
}

/**
 * The AI Catalog. `displayName` and `description` repeat the card's, which the
 * catalog spec says to omit and ARD's validator asks for; the values come from the
 * same constants, so here they cannot drift apart.
 */
export function aiCatalog(server) {
  return {
    specVersion: "1.0",
    host: {
      displayName: server.title,
      identifier: "wisemind.calebsargeant.com",
      documentationUrl: `${ENDPOINT}llms.txt`,
      logoUrl: server.icons[0].src,
    },
    entries: [
      {
        identifier: "urn:air:calebsargeant.com:mcp:wise-mind",
        displayName: server.title,
        type: SERVER_CARD_TYPE,
        url: CARD_URL,
        description: DESCRIPTION,
        tags: ["dbt", "dialectical behaviour therapy", "emotional support", "boundaries", "acceptance", "self-help"],
        representativeQueries: [
          "My friend didn't invite me and I can't stop thinking about it",
          "How do I tell my manager I can't take on more work?",
          "I'm so angry at my partner I can't think straight",
          "How do I stop caring what other people think of me?",
          "Walk me through the DBT DEAR MAN skill",
          "How do I stop trying to control what other people do?",
        ],
      },
    ],
  };
}

/**
 * RFC 9727: the catalog lists the API (as an `item`, which the RFC requires), then
 * says where its machine-readable description (the card) and its documentation
 * (the guide at /) are.
 */
export function apiCatalog() {
  return {
    linkset: [
      {
        anchor: `${ENDPOINT}.well-known/api-catalog`,
        item: [{ href: ENDPOINT, title: "wise-mind: a public, read-only MCP server" }],
      },
      {
        anchor: ENDPOINT,
        "service-desc": [{ href: CARD_URL, type: SERVER_CARD_TYPE }],
        "service-doc": [{ href: ENDPOINT, type: "text/html" }],
      },
    ],
  };
}

/** A strong ETag over the exact bytes served, so If-None-Match can answer 304. */
export async function etagOf(body) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex.slice(0, 32)}"`;
}

/** RFC 9110 If-None-Match: `*`, or a list of tags compared weakly (a W/ prefix is ignored). */
export function matchesIfNoneMatch(header, etag) {
  if (!header) return false;
  const bare = (tag) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || bare(tag) === bare(etag));
}
