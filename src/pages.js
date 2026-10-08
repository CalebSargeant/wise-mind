/**
 * The few things this Worker serves that are not JSON-RPC: the page a person sees
 * when they open the URL, the same guide as markdown for agents, the icon, and the
 * well-known files every public hostname is expected to carry.
 *
 *   GET /                         HTML for a browser, markdown for anything else,
 *                                 405 for anything asking for an event stream
 *   GET /llms.txt                 the same guide, for agents (llmstxt.org)
 *   GET /icon.svg, /icon.png      the Wise Mind mark (scripts/build-icon.mjs)
 *   GET /robots.txt               crawl policy
 *   GET /.well-known/security.txt RFC 9116
 *
 * Built from the live tool and prompt sets, so the page cannot describe a tool the
 * server does not have. Same shape as mcp.calebsargeant.com's pages.js.
 */

import { SUPPORTED_VERSIONS } from "./mcp.js";
import { ENDPOINT, REPOSITORY } from "./server.js";
import { ICON_PNG_BASE64, ICON_SVG as SVG } from "./icon.js";
import { DIRECTORIES } from "./content/crisis.js";
import { TRADEMARK } from "./content/let-them.js";

const CONTACT = "contact@calebsargeant.com";
const WEBSITE = "https://calebsargeant.com/";

export const ICON_SVG = SVG;
export const ICON_PNG = Uint8Array.from(atob(ICON_PNG_BASE64), (c) => c.charCodeAt(0));

const NOT_AFFILIATED =
  "An independent, free, open-source project. Not affiliated with, endorsed by or sponsored by Mel Robbins, Mel Robbins Productions, " +
  `Hay House, Cassie Phillips, Marsha Linehan, Behavioral Tech, the Linehan Institute or dbt.tools. ${TRADEMARK} DBT skill names are used for education; ` +
  "every explanation is original.";

const NOT_THERAPY =
  "Self-help education, not therapy, medical advice, diagnosis or a crisis service.";

/** RFC 9116 `Expires`: the first day of the month six months out, so every response in a month agrees. */
export function securityExpiry(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, 1)).toISOString();
}

export function securityTxt(now) {
  return [
    "# Vulnerability disclosure for wisemind.calebsargeant.com, RFC 9116.",
    "#",
    "# A public, read-only MCP server with no authentication, no storage and nothing",
    "# to sign in to. There is no bug bounty.",
    `Contact: mailto:${CONTACT}`,
    `Expires: ${securityExpiry(now)}`,
    "Preferred-Languages: en",
    `Canonical: ${ENDPOINT}.well-known/security.txt`,
    "",
  ].join("\n");
}

export const ROBOTS_TXT = [
  "# wisemind.calebsargeant.com is an MCP endpoint with one human-readable page at /.",
  "# Allowed: being found by people and assistants who need it is the point.",
  "User-agent: *",
  "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
  "Allow: /",
  "",
  "# The AI Catalog listing this server's card, for agent registries.",
  `Agentmap: ${ENDPOINT}.well-known/ai-catalog.json`,
  "",
].join("\n");

/**
 * The privacy policy, at a stable URL because connector directories ask for one.
 * Every claim about the server is a property of the code: no storage binding, no
 * outbound fetch, invocation logs and traces off in wrangler.toml, the page's CSP
 * and no-transform, and tests/tools.test.mjs proving no tool argument reaches the
 * console. The IP-keyed rate limiter and the zone's own analytics are Cloudflare's,
 * and the policy says so rather than leaving them out.
 */
export const PRIVACY_TXT = [
  "Wise Mind MCP server: privacy",
  "",
  "What this server receives: the arguments your AI assistant sends when it uses a tool. They are",
  "categories (a situation type such as 'criticism-at-work', emotion families, a 0-10 intensity, a goal,",
  "who the other person is to you, your country) and at most a few words of topic, a skill's name or an",
  "emotion word. When you start one of its slash commands, only the command's name is sent. The tools are",
  "designed so that your story, names and details stay in your conversation and are never sent here.",
  "",
  "What it does with them: builds a guide from content bundled in the server, returns it, and forgets.",
  "",
  "What it keeps: nothing. The server has no database, no file storage, no account, no cookie and no",
  "analytics (the web page at / blocks Cloudflare's analytics beacon), and it calls no other service. Its",
  "own request logs and traces are switched off. If a tool fails, the error log records the tool's name",
  "and the error, never what was sent.",
  "",
  "Your network address: each request's IP address is the key of a 60-second rate-limit counter that",
  "stops abuse. It is not stored by this server.",
  "",
  "Hosting: Cloudflare Workers, on the calebsargeant.com zone. Cloudflare processes requests to deliver",
  "them, under its own privacy policy: https://www.cloudflare.com/privacypolicy/ . Its standard traffic",
  "and security analytics for the zone (IP address, country, browser, time and path; never the request",
  "body or tool arguments) are visible to the operator for Cloudflare's retention period, and are not",
  "used to identify anyone.",
  "",
  "Your assistant: your conversation is handled by your AI assistant's provider under their terms. This",
  "server sees only the tool arguments and slash-command names, not the conversation.",
  "",
  `Source code: ${REPOSITORY} (every claim above can be checked there).`,
  `Contact: ${CONTACT}`,
  "",
].join("\n");

const sorted = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));

/** The markdown guide: the body of /llms.txt, and the answer to a non-browser GET /. */
export function guideMarkdown(tools, prompts = []) {
  return [
    "# Wise Mind MCP server",
    "",
    "> A public, read-only Model Context Protocol server that gives an assistant DBT (Dialectical Behaviour Therapy) skills " +
      "and the Let Them / Let Me idea, so it can help a person through a hard moment with other people, practically and emotionally. " +
      "No sign-in, no API key, nothing stored.",
    "",
    `If you are in crisis or thinking about ending your life, contact your local emergency number or a crisis line now: ${DIRECTORIES[0].url}`,
    "",
    `Endpoint: ${ENDPOINT} (Streamable HTTP, POST, JSON responses). Protocol versions: ${SUPPORTED_VERSIONS.join(", ")}. ` +
      "There is no `/mcp` path; the hostname is the endpoint.",
    "",
    "## Connect",
    "",
    `- Claude Code: \`claude mcp add --transport http wise-mind ${ENDPOINT}\`, or the plugin, which adds a skill that tells Claude when to use it: ` +
      "`claude plugin marketplace add CalebSargeant/wise-mind`, then `claude plugin install wise-mind@wise-mind`",
    `- Claude apps (claude.ai, desktop, mobile): Settings, Connectors, Add custom connector, URL ${ENDPOINT}`,
    "- Any other client: point its Streamable HTTP transport at the same URL. Nothing to authenticate.",
    "",
    "Once connected, the assistant calls these on its own when you describe something hard. You don't need to ask for DBT by name.",
    "",
    "## Tools",
    "",
    ...sorted(tools).map((t) => `- \`${t.name}\`: ${t.title}.`),
    "",
    ...(prompts.length ? ["## Prompts (slash commands)", "", ...sorted(prompts).map((p) => `- \`${p.name}\`: ${p.description}`), ""] : []),
    "## Privacy",
    "",
    "The assistant sends categories (a situation type, emotion families, a 0-10 intensity), never your story or names. " +
      `The server stores nothing, logs no tool arguments and calls nothing else. Policy: ${ENDPOINT}privacy`,
    "",
    "## About",
    "",
    `- ${NOT_THERAPY}`,
    `- ${NOT_AFFILIATED}`,
    `- Source: ${REPOSITORY}`,
    "- Discovery: " + `${ENDPOINT}server-card, ${ENDPOINT}.well-known/ai-catalog.json, ${ENDPOINT}.well-known/api-catalog`,
    `- Contact: ${CONTACT}; security: ${ENDPOINT}.well-known/security.txt`,
    "",
  ].join("\n");
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The page a browser gets. Inline styles, no script, its own icon. */
export function guideHtml(tools, prompts = []) {
  const description =
    "An MCP server that gives your AI assistant DBT skills and the Let Them / Let Me idea, so it can help you through hard moments with people. Free, public, nothing stored.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    "@id": `${ENDPOINT}#api`,
    name: "Wise Mind MCP server",
    description,
    url: ENDPOINT,
    documentation: `${ENDPOINT}llms.txt`,
    isAccessibleForFree: true,
    provider: { "@type": "Person", "@id": `${WEBSITE}#person`, name: "Caleb Sargeant", url: WEBSITE },
  };
  const item = (name, text) => `<li><code>${escapeHtml(name)}</code> ${escapeHtml(text)}</li>`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wise Mind MCP server</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${ENDPOINT}">
<link rel="alternate" type="text/markdown" href="${ENDPOINT}llms.txt">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="color-scheme" content="dark light">
<meta property="og:type" content="website">
<meta property="og:title" content="Wise Mind MCP server">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${ENDPOINT}">
<meta property="og:image" content="${ENDPOINT}icon.png">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
<style>
  :root { --ink:#0B111C; --panel:#121A29; --line:rgba(255,255,255,.1); --fg:#EEF2F8; --dim:#A9B6C8; --sig:#F5D37A; --warn:#FF9C8A; }
  @media (prefers-color-scheme: light) {
    :root { --ink:#F7F8FB; --panel:#FFFFFF; --line:rgba(11,17,28,.12); --fg:#0E1522; --dim:#46536A; --sig:#7A5A0A; --warn:#A6382A; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ink); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:44rem; margin:0 auto; padding:3rem 1rem 4rem; }
  header { display:flex; gap:1rem; align-items:center; margin-bottom:1rem; }
  header img { width:56px; height:56px; border-radius:14px; }
  h1 { font-size:clamp(1.8rem,5vw,2.4rem); line-height:1.15; letter-spacing:-.02em; margin:0; }
  h2 { font-size:1rem; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:2.25rem 0 .75rem; }
  p, li { color:var(--dim); } strong { color:var(--fg); }
  a { color:var(--sig); }
  code, pre { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.9em; }
  pre { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:.9rem 1rem; overflow-x:auto; color:var(--fg); white-space:pre-wrap; word-break:break-all; }
  .endpoint { display:inline-block; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:.35rem .6rem; color:var(--fg); word-break:break-all; }
  .crisis { border-left:3px solid var(--warn); padding:.5rem .9rem; background:var(--panel); border-radius:6px; }
  ul { padding-left:1.2rem; }
  li code { color:var(--fg); }
  .small { font-size:.88rem; }
</style>
</head>
<body>
<main>
<header><img src="/icon.svg" alt="" width="56" height="56"><h1>Wise Mind</h1></header>
<p>${escapeHtml(description)}</p>
<p class="crisis"><strong>In crisis?</strong> If you are thinking about ending your life or are in danger, call your local emergency number or find a free crisis line at <a href="${DIRECTORIES[0].url}">findahelpline.com</a>. This server is not a crisis service.</p>
<h2>What it does</h2>
<p>Connect it to your assistant once. From then on, when you describe something hard (a fight, criticism, being left out, guilt, a boundary you need to set, a conversation you dread), the assistant draws on it by itself: it listens and shows it understands first, helps you settle if it's all too much, sorts what belongs to the other person (<strong>let them</strong>) from what is yours to do (<strong>let me</strong>), and suggests one or two DBT skills and a small next step.</p>
<h2>Connect</h2>
<p><span class="endpoint">${ENDPOINT}</span></p>
<pre>claude mcp add --transport http wise-mind ${ENDPOINT}</pre>
<p>Or, in Claude Code, the plugin, which adds a skill that tells Claude when to use it:</p>
<pre>claude plugin marketplace add CalebSargeant/wise-mind
claude plugin install wise-mind@wise-mind</pre>
<p>In the Claude apps: Settings, Connectors, Add custom connector, and paste the URL. Any other MCP client: use its Streamable HTTP transport. There is nothing to sign in to.</p>
<h2>Tools</h2>
<ul>
${sorted(tools).map((t) => item(t.name, t.title)).join("\n")}
</ul>
${prompts.length ? `<h2>Slash commands</h2>\n<ul>\n${sorted(prompts).map((p) => item(p.name, p.title)).join("\n")}\n</ul>` : ""}
<h2>Privacy</h2>
<p>The assistant sends categories (a situation type, emotion families, a 0 to 10 intensity), never your story or names. The server stores nothing, logs no tool arguments and calls nothing else. <a href="/privacy">Privacy policy</a>.</p>
<h2>About</h2>
<p class="small">${escapeHtml(NOT_THERAPY)} DBT is a structured treatment developed by Marsha Linehan; for persistent distress, a GP or a DBT-trained therapist is the right next step. Let Them / Let Me was popularised by The Let Them Theory (Mel Robbins with Sawyer Robbins, 2024) and has older roots: Stoicism, the Serenity Prayer, radical acceptance and Acceptance and Commitment Therapy (ACT).</p>
<p class="small">${escapeHtml(NOT_AFFILIATED)}</p>
<p class="small">Streamable HTTP, POST, JSON. Protocol versions ${escapeHtml(SUPPORTED_VERSIONS.join(", "))}. <a href="/server-card">Server Card</a> · <a href="/.well-known/ai-catalog.json">AI Catalog</a> · <a href="/llms.txt">llms.txt</a> · <a href="${REPOSITORY}">source</a> · <a href="mailto:${CONTACT}">${CONTACT}</a></p>
</main>
</body>
</html>
`;
}
