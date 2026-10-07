# Wise Mind

A public, read-only [Model Context Protocol](https://modelcontextprotocol.io) server that
gives an AI assistant the skills of Dialectical Behaviour Therapy (DBT) and the Let Them /
Let Me idea, so it can help a person through a hard moment with other people, practically
and emotionally. No sign-in, no API key, nothing stored.

> **In crisis?** If you are thinking about ending your life or are in danger, call your
> local emergency number or find a free crisis line at
> [findahelpline.com](https://findahelpline.com/). This server is not a crisis service.

Once it is connected, the assistant uses it on its own. Someone says "my sister didn't
invite me to her birthday and I can't stop thinking about it", and the assistant listens and
shows it understands first, helps them settle if it's all too much, sorts what belongs to the
sister (**let them**) from what is their own to do (**let me**), and offers one or two DBT
skills and a small next step. Nobody has to ask for "DBT".

## Connect

```bash
claude mcp add --transport http wise-mind https://wisemind.calebsargeant.com/
```

Or install it as a Claude Code plugin, which adds a skill that tells Claude when to use it
(more reliable than the server alone):

```bash
claude plugin marketplace add CalebSargeant/wise-mind
```

```bash
claude plugin install wise-mind@wise-mind
```

In the Claude apps (claude.ai, desktop, mobile): Settings, Connectors, Add custom connector,
URL `https://wisemind.calebsargeant.com/`. The hostname is the endpoint; there is no `/mcp`
path. Any other MCP client: point its Streamable HTTP transport at the same URL.

## Tools

| Tool | Returns |
|---|---|
| `wise_mind_work_through_situation` | The front door. A short guide for the assistant: validate, calm the body if 7/10 or more, sort theirs / mine / shared, two or three DBT skills, one small step, a question to ask |
| `wise_mind_crisis_support` | How to respond in a crisis, plus local crisis lines, domestic abuse services and emergency numbers for 25 countries, and directories for the rest. Never rate limited |
| `wise_mind_theirs_or_mine` | The Let Them / Let Me framework bridged to DBT: what to accept and the skills for it, what to own and the skills for it, and where "let them" never applies |
| `wise_mind_plan_conversation` | A DEAR MAN / GIVE / FAST script scaffold for asking, saying no, setting a boundary, raising a problem or repairing, fitted to the priority, the channel and the likely reaction |
| `wise_mind_understand_emotion` | One of ten emotion families: prompts, body signs, the urge, when it fits the facts, problem-solving if it does, opposite action if it doesn't |
| `wise_mind_skill` | One DBT skill in full (37 skills), a ranked shortlist for a few words, or the whole list |

And four prompts, for a person who wants to start one themselves (in Claude Code they appear
as slash commands): `hard_moment`, `theirs_or_mine`, `prepare_conversation`, `check_in`. They
take no arguments, so nothing a person types after the command is sent to the server.

## How DBT and Let Them / Let Me fit together

DBT is built on one tension: accept reality as it is, **and** work to change what can be
changed. Let Them / Let Me cuts that same tension along one line, other people versus
yourself. *Let them* is the acceptance pole, aimed at what other adults do, think and feel;
*let me* is the change pole, aimed at your own next move.

The slogan is easy to remember under stress and thin on method, and DBT supplies the method:

- before choosing anything, **STOP** and **TIPP** to get the body down;
- **Check the Facts** to test the story you're telling yourself;
- for the "let them" side, **Radical Acceptance**, **Turning the Mind** and **Willingness**;
- for the "let me" side, **DEAR MAN**, **GIVE** and **FAST** when you need to ask, refuse or
  negotiate, **Opposite Action** when an urge would make things worse, and **Problem
  Solving** and **Cope Ahead** for the part that is yours;
- and acceptance turned inward, **Self-Validation**, so "let me" is not a whip.

Every guide sorts in three, not two: **theirs**, **mine** and **shared** (money, a home,
children, a team deliverable: their choice lands on you, so it needs negotiating). And
every guide checks the cases where "let them" is the wrong tool: abuse or danger, someone at
risk, a dependant's safety, a workplace issue to escalate, or criticism that holds facts
worth acting on. `src/content/let-them.js` has the full mapping.

## Safety

- **Four levels**, from the assistant's `safety` flag (on every tool but `wise_mind_skill`) or
  from the words themselves (`topic`, an `emotion` word, a `skill` query all go through the
  same screen):
  `suicide_or_self_harm` and `someone_else_at_risk` replace the guide with crisis guidance
  and local lines, with no skills menu; `abuse_or_unsafe` returns safety planning and
  domestic abuse services, and never "let them" or a script to confront someone;
  `hopeless_or_burden` puts a gentle safety check-in above the usual guide.
- **Additive.** The crisis guidance adds local numbers to the assistant's own crisis care and
  never tells it to skip or soften it. It follows safe-messaging practice: ask directly, stay,
  never discuss methods or means, keep it hopeful.
- **Crisis lines** (`src/content/crisis.js`) were each checked on the service's own website
  on the date in `CHECKED`, which is printed with every answer. `tests/content.test.mjs`
  fails CI a year after that date, so stale numbers can't ship quietly. To re-verify: open
  each line's `url`, update the entry and `CHECKED`, and run `npm test`.
- **TIPP's** cold water and hard exercise always carry the medical caution (heart conditions,
  low heart rate, beta blockers, eating disorders) and a gentler alternative.
- **Not therapy.** Self-help education, labelled as such everywhere. No diagnosis, no labels
  for anyone, and a pointer to a GP or a DBT-trained therapist for distress that keeps coming
  back.

## Privacy

The tools take **categories, not stories**: a situation type, emotion families, a 0 to 10
intensity, a goal, who the other person is, a country. The free text is limited to an optional
`topic` (120 characters, for situations no playbook covers), a `skill` lookup (120), an
`emotion` word (60) and a `country` (60); the prompts take no arguments at all. Clients show tool
arguments on their permission cards, so these read as gentle labels rather than a retelling
of someone's worst week, and a story that never leaves the conversation can't leak from here.

The Worker has no storage binding and makes no outbound requests. Invocation logs and traces
are off in `wrangler.toml`; the only log line is a handler failure (tool name and stack, never
arguments), and `tests/tools.test.mjs` proves no argument reaches the console. The page at `/`
is sent with `no-transform` and a script-free CSP, so the zone's analytics beacon is neither
injected nor run. The client IP is the key of the rate limiter, and the zone's own Cloudflare
analytics see requests as they do for any site; the policy at
[/privacy](https://wisemind.calebsargeant.com/privacy) says both.

## How the assistant knows when to use it

Clients decide from three things, so all three carry the triggers in the words people use:

- **Server instructions** (`src/server.js`): what it is, when to use it, the workflow,
  the safety route and what it is not, in that order and under 1,500 characters. No
  "always" or "must", which connector review rejects.
- **Tool names and descriptions** (`src/tools.js`): each starts with what it returns, then
  "Use when". Names carry a `wise_mind_` prefix because a synced connector reaches the model
  as `mcp__<uuid>__<name>`.
- **`_meta["anthropic/alwaysLoad"]`** on the front door and the crisis tool, so Claude Code
  keeps those two loaded instead of behind a tool search.

The plugin adds a skill (`plugin/skills/wise-mind/SKILL.md`) with the same triggers, which is
the strongest signal Claude Code has. `scripts/eval-invocation.mjs` checks the result for
real: 30 messages, 20 that should trigger and 10 that shouldn't, through `claude -p`.

## The content

Everything a client reads is in `src/content/`, bundled into the Worker, so what is served
is exactly what this repository holds at the deployed commit.

| File | What |
|---|---|
| `skills.js` | 37 DBT skills: every skill on [dbt.tools](https://dbt.tools/), plus standard or widely taught skills it doesn't cover (Check the Facts, validation, Walking the Middle Path, Turning the Mind, Willingness, and others). Where dbt.tools and Linehan differ, it follows Linehan and says so |
| `emotions.js` | Ten emotion families, with the everyday words for each |
| `situations.js` | 32 situation playbooks, each cut along the Let Them / Let Me line |
| `let-them.js` | The framework, the mapping to DBT, the exceptions, and the step-by-step flow |
| `crisis.js` | Crisis lines, domestic abuse services and emergency numbers, with the date they were checked |

All of it is written for this project in its own words. Skill names and acronym letters are
the only things taken from the sources; no text from dbt.tools, Linehan's manuals or the
book is reproduced. `tests/content.test.mjs` holds the content to its own rules: every
cross-reference resolves, every dbt.tools skill is covered, the keyword fallback finds each
playbook from an ordinary sentence, and there are no em dashes.

### Where the ideas come from

DBT was developed by Marsha Linehan. The Let Them / Let Me idea was popularised by *The Let
Them Theory* (Mel Robbins with Sawyer Robbins, 2024), and is also expressed in earlier writing
such as Cassie Phillips' 2022 poem; it has older roots in Epictetus' dichotomy of control, the
Serenity Prayer, radical acceptance in DBT and acceptance in Acceptance and Commitment Therapy
(ACT). The phrase stays out of every name here (repository, hostname, tools, prompts).

Independent, free, open-source project. Not affiliated with, endorsed by or sponsored by
Mel Robbins, Mel Robbins Productions, Hay House, Cassie Phillips, Marsha Linehan, Behavioral
Tech, the Linehan Institute or dbt.tools. Mel Robbins Productions, Inc. has applied to
register LET THEM and LET THEM THEORY as trademarks; the phrases are used here only to describe
an idea this project draws on. This is not therapy, medical advice or a crisis service.

## Transport

The protocol layer (`src/mcp.js`) is CalebSargeant/mcp's, plus prompts. Streamable HTTP,
POST, JSON responses, no sessions, and both eras of the protocol on the one endpoint:
2026-07-28 (per-request `_meta`, header validation, `server/discover`) and 2025-11-25 back to
2024-11-05 (the `initialize` handshake). A browser opening the URL gets a page; anything else
gets the same guide as markdown; `/llms.txt`, `/privacy`, `/robots.txt`,
`/.well-known/security.txt`, the Server Card (`/server-card`) and the AI and API catalogues
are served too.

## Operating it

```bash
npm test          # protocol, safety, content integrity, pages, discovery
npm run bindings  # wrangler deploy --dry-run: must list env.BURST and env.BURST_HOSTED
npm run dev       # local, on http://localhost:8787/
```

`node scripts/eval-invocation.mjs --url http://127.0.0.1:8787/` runs the invocation eval
against `npm run dev` (needs a logged-in Claude Code CLI). `node scripts/build-icon.mjs`
rebuilds `src/icon.js` from the icon's geometry.

### Deploying

A merge to `main` deploys through MagmaMoose/tremvok's `cloudflare-workers` target, the same
way CalebSargeant/mcp ships; a pull request is a dry run. One repository secret:

- `CLOUDFLARE_API_TOKEN`: an account token for the Magma Moose account (where the
  calebsargeant.com zone lives) with **Workers Scripts: Edit** and **Workers Routes: Edit**
  on calebsargeant.com. The token CalebSargeant/mcp uses has both.

The first deploy creates the `wisemind.calebsargeant.com` Custom Domain, its DNS record and
its certificate. There is no bucket or other resource to create first.

## What it deliberately does not have

- **No storage, no accounts, no analytics, no outbound calls.**
- **No rate limit on safety.** The handshake, the listings, `wise_mind_crisis_support` and any
  call already on the safety route are never braked; Anthropic's outbound range (every Claude-app user) has its own, larger bucket;
  and a braked tool call comes back as a readable result with the crisis directory in it.
- **No write verbs.** Every tool is read-only and marked so.
- **No free-text story fields.** Categories in, guidance out.
- **No `[assets]`.** It is Worker-level and would put the asset router in front of `/`.

## Licence

Apache-2.0. See `LICENSE`.
