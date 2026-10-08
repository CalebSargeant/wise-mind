import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES, SKILLS } from "../src/content/skills.js";
import { EMOTIONS } from "../src/content/emotions.js";
import { SITUATIONS } from "../src/content/situations.js";
import { EXCEPTIONS, FLOW, MAPPINGS } from "../src/content/let-them.js";
import { CHECKED, COUNTRIES, COUNTRY_ALIASES, DIRECTORIES } from "../src/content/crisis.js";
import { findCountry, findSkill, matchSituations, screen } from "../src/guide.js";

/**
 * The content is the product, so its integrity is tested like code: every
 * cross-reference resolves, every dbt.tools skill is covered, the keyword fallback
 * finds each playbook from an ordinary sentence, and the crisis table is dated,
 * sourced and not allowed to go stale silently.
 */

const ids = new Set(SKILLS.map((s) => s.id));

test("every skill is complete and its id is unique", () => {
  assert.equal(ids.size, SKILLS.length);
  for (const s of SKILLS) {
    assert.match(s.id, /^[a-z0-9-]+$/, s.id);
    assert.ok(MODULES.some((m) => m.id === s.module), `${s.id}: unknown module ${s.module}`);
    assert.ok(s.name.length >= 2, `${s.id}.name`);
    for (const field of ["purpose", "example", "letThem", "letMe"]) assert.ok(s[field]?.length > 10, `${s.id}.${field}`);
    for (const field of ["whenToUse", "steps", "pitfalls"]) assert.ok(s[field].length >= 2, `${s.id}.${field}`);
    assert.ok(["crisis", "high", "moderate", "any"].includes(s.intensity), `${s.id}.intensity`);
  }
});

test("every cross-reference to a skill resolves", () => {
  const refs = [
    ...SKILLS.flatMap((s) => s.related.map((r) => [`skill ${s.id}`, r])),
    ...SITUATIONS.flatMap((s) => s.skills.map((r) => [`situation ${s.id}`, r])),
    ...EMOTIONS.flatMap((e) => e.skills.map((r) => [`emotion ${e.id}`, r])),
    ...MAPPINGS.flatMap((m) => m.skills.map((r) => [`mapping ${m.what}`, r])),
  ];
  for (const [from, id] of refs) assert.ok(ids.has(id), `${from} refers to unknown skill ${id}`);
});

test("every skill on dbt.tools is covered and links to its page", () => {
  const pages = [
    "mindfulness/wise-mind", "mindfulness/what", "mindfulness/how",
    "distress_tolerance/accepts", "distress_tolerance/tip", "distress_tolerance/self-soothe", "distress_tolerance/improve",
    "distress_tolerance/pro-con", "distress_tolerance/problem-solving", "distress_tolerance/radical-acceptance",
    "emotional_regulation/stop", "emotional_regulation/opposite-action", "emotional_regulation/abc-please",
    "emotional_regulation/build-mastery", "emotional_regulation/cope-ahead", "emotional_regulation/self-talk",
    "interpersonal_effectiveness/dear-man", "interpersonal_effectiveness/give", "interpersonal_effectiveness/fast",
    "interpersonal_effectiveness/boundary-building",
  ];
  const linked = new Set(SKILLS.map((s) => s.dbtTools).filter(Boolean));
  for (const page of pages) {
    const url = `https://dbt.tools/${page}.php`;
    // STOP and Problem Solving each sit in two modules across sources; either page counts.
    const alt = { "distress_tolerance/problem-solving": "emotional_regulation/problem-solving", "emotional_regulation/stop": "distress_tolerance/stop" }[page];
    assert.ok(linked.has(url) || (alt && linked.has(`https://dbt.tools/${alt}.php`)), `nothing links ${url}`);
  }
});

test("no two skills answer to the same name", () => {
  const owner = new Map();
  for (const s of SKILLS) {
    for (const name of [s.id, s.name, ...s.aliases]) {
      const k = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!k) continue;
      assert.ok(!owner.has(k) || owner.get(k) === s.id, `"${name}" belongs to both ${owner.get(k)} and ${s.id}`);
      owner.set(k, s.id);
    }
  }
});

test("every skill is findable by its own name", () => {
  for (const s of SKILLS) assert.equal(findSkill(s.name)?.id, s.id, s.name);
});

test("the keyword fallback finds each playbook from an ordinary sentence", () => {
  const samples = {
    "criticism-at-work": "My boss gave me harsh feedback on my presentation in front of the team",
    "left-out": "I saw photos of my friends at dinner and I wasn't invited",
    "waiting-for-a-reply": "My boyfriend hasn't replied to my texts all day",
    "family-judging-choices": "My parents keep judging my decision to quit law",
    "comparison": "Everyone on instagram seems so successful and I'm comparing myself",
    "ex-moved-on": "My ex has moved on and is dating someone new already",
    "someone-angry-at-me": "My flatmate is furious with me and gave me the silent treatment",
    "people-pleasing": "I can't say no to anyone, I'm such a people pleaser",
    "setting-a-boundary": "My mother-in-law keeps overstepping and I need a boundary",
    "credit-taken": "A colleague took credit for my work in the all-hands",
    "parent-adult-child-conflict": "My adult son and I had a big fight and we're not speaking",
    "ghosted": "He just ghosted me after three dates",
    "rumination": "I can't stop replaying the conversation, I'm lying awake at 3am",
    "what-others-think": "I'm terrified of what people will think if I post my art",
    "procrastination": "I keep putting off my thesis and the deadline is next week",
    "they-wont-change": "My friend keeps cancelling on me again and again",
    "grief-and-loss": "My dad died last month and I'm struggling with grief",
    "someone-elses-drinking": "My husband drinks too much every weekend",
    "lending-money": "My brother keeps asking to borrow money again",
    "disagree-with-decision": "My manager made a decision I really disagree with",
    "passed-over": "I was passed over for the promotion I'd worked for",
    "teenager-risky-choices": "My teenager is vaping and sneaking out",
    "shared-problem": "My housemate does nothing around the house and I do all the chores",
    "harassment-at-work": "A colleague keeps making sexual comments and it feels like harassment",
    "controlling-partner": "My partner checks my phone and won't let me see my friends",
    "friend-at-risk": "My friend told me she wants to end her life",
    "holiday-family-pressure": "My in-laws are guilting us about Christmas plans",
    "rude-stranger": "A driver cut me off and screamed at me in traffic",
    "friendship-drifting": "My best friend and I are drifting apart, it's always me reaching out",
    "partner-wont-commit": "He gives me mixed signals and won't commit",
    "adult-meltdown": "My dad has a meltdown whenever plans change and I walk on eggshells",
    "comments-about-body": "My mum comments on my weight every time I visit",
  };
  for (const s of SITUATIONS) assert.ok(samples[s.id], `no sample sentence for ${s.id}`);
  for (const [id, text] of Object.entries(samples)) {
    const top = matchSituations(text)[0]?.situation.id;
    assert.equal(top, id, `"${text}" matched ${top}`);
  }
});

test("the routing edge cases the review found stay fixed", () => {
  const cases = {
    // A child in the person's care is never the adult-child playbook.
    "My son and I fight constantly about curfew": "teenager-risky-choices",
    "My 15 year old daughter is drinking alcohol": "teenager-risky-choices",
    "My teenage son is drunk every weekend": "teenager-risky-choices",
    "My 35 year old son is drunk again": "someone-elses-drinking",
    "My adult son and I are estranged": "parent-adult-child-conflict",
    // Harassment in everyday words.
    "My manager keeps making sexual jokes about me": "harassment-at-work",
    "A coworker keeps touching me at work": "harassment-at-work",
    "Someone at work used a slur at me": "harassment-at-work",
    // Shared problems are not someone else's alone.
    "My wife made a bad decision about our mortgage": "shared-problem",
    "My ex won't pay child support": "shared-problem",
    "My partner won't pay their half of the rent": "shared-problem",
    // Fear of someone's temper goes to the abuse path.
    "I'm afraid of his temper": "controlling-partner",
    "My partner belittles me constantly": "controlling-partner",
    "My sister has been cutting again": "friend-at-risk",
  };
  for (const [text, id] of Object.entries(cases)) assert.equal(matchSituations(text)[0]?.situation.id, id, text);
  for (const text of ["My friend keeps cutting me out of plans", "My colleague keeps cutting corners", "My brother is abusing my trust", "My sister is hostile to me", "His kind words really touched me", "I keep stalking my ex's instagram"]) {
    const top = matchSituations(text)[0]?.situation.id;
    assert.ok(!["friend-at-risk", "controlling-partner", "harassment-at-work"].includes(top), `"${text}" went to ${top}`);
  }
  for (const text of ["it hit me that my sister never calls", "that pushed me to quit", "my mum pushed me to apply for law"]) assert.equal(screen(text), "none", text);
  for (const text of ["he pushed me into the wall", "she slapped me", "he chokes me", "my uncle pushed me to have sex", "my stepdad pushed me to the edge of the stairs", "he hit me to make me stop talking"]) {
    assert.equal(screen(text), "abuse_or_unsafe", text);
  }
  const more = {
    "My boss makes sexual comments about my body": "harassment-at-work",
    "A colleague keeps making comments about my body": "harassment-at-work",
    "My mom criticizes my weight every time I visit": "comments-about-body",
    "My boss criticised my presentation to my face in front of the team": "criticism-at-work",
    "My friend said she won't eat with us anymore and I feel left out": "left-out",
    "My husband is abusing me": "controlling-partner",
    "My dad hurts me": "controlling-partner",
    "My stepdad hurts me": "controlling-partner",
    "My friend told me she has been cutting in secret": "friend-at-risk",
    "My son and I argue about school": "teenager-risky-choices",
    "My flatmate yells at me": "someone-angry-at-me",
  };
  for (const [text, id] of Object.entries(more)) assert.equal(matchSituations(text)[0]?.situation.id, id, text);
  for (const text of ["My half-brother and I argue all the time", "My brother is abusing drugs"]) {
    const top = matchSituations(text)[0]?.situation.id;
    assert.ok(!["shared-problem", "controlling-partner"].includes(top), `"${text}" went to ${top}`);
  }
});

test("screen: the person speaking is not mistaken for someone else, and indirect wording is caught", () => {
  const expect = {
    "my girlfriend dumped me and I want to die": "suicide_or_self_harm",
    "since my wife left I want to die": "suicide_or_self_harm",
    "my husband hits me and I want to die": "suicide_or_self_harm",
    "my wife left and i'm suicidal": "suicide_or_self_harm",
    "my son told me he wants to die": "someone_else_at_risk",
    "I think my sister wants to die": "someone_else_at_risk",
    "i'm worried my friend is suicidal": "someone_else_at_risk",
    "harmed myself": "suicide_or_self_harm",
    "unaliving": "suicide_or_self_harm",
    "i relapsed and cut again": "suicide_or_self_harm",
    "I took all my pills": "suicide_or_self_harm",
    "swallowed a handful of pills": "suicide_or_self_harm",
    "going to take all my pills": "suicide_or_self_harm",
    "they'd be fine without me": "hopeless_or_burden",
    "can't do this any more": "hopeless_or_burden",
    "i want it all to stop": "hopeless_or_burden",
    "i can't keep going": "hopeless_or_burden",
    "I am scared of my husband": "abuse_or_unsafe",
    "my dad hurts me when he drinks": "abuse_or_unsafe",
    "my partner hits our kids": "abuse_or_unsafe",
    "tired of living with my in-laws": "none",
    "don't want to live with my sister": "none",
    "running 10 kms": "none",
    "no way out of the contract": "none",
    "scared of my husband's reaction": "none",
    "scared to go home for christmas": "none",
    "he grabs me a coffee every morning": "none",
    "the game got violent": "none",
    "I forgot to take my pills this morning": "none",
    "I keep stalking my ex's instagram": "none",
    "my ex is stalking me": "abuse_or_unsafe",
    "I think I'm being stalked": "abuse_or_unsafe",
  };
  for (const [text, level] of Object.entries(expect)) assert.equal(screen(text), level, text);
});

test("the dangerous playbooks are marked so the guide never offers acceptance there", () => {
  for (const id of ["controlling-partner", "friend-at-risk", "harassment-at-work", "teenager-risky-choices"]) {
    assert.ok(SITUATIONS.find((s) => s.id === id).notLetThem, id);
  }
  assert.ok(EXCEPTIONS.some((x) => /abuse/i.test(x.name)));
  assert.match(FLOW[0].step, /Safety/);
});

test("emotion families are complete and their everyday words do not collide", () => {
  const seen = new Map();
  for (const e of EMOTIONS) {
    for (const field of ["prompts", "body", "urge", "fitsWhen", "ifItFits", "opposite", "letThem", "letMe"]) assert.ok(e[field]?.length > 10, `${e.id}.${field}`);
    for (const a of e.aliases) {
      assert.ok(!seen.has(a) || seen.get(a) === e.id, `"${a}" is in both ${seen.get(a)} and ${e.id}`);
      seen.set(a, e.id);
    }
  }
});

test("every crisis line is sourced, every country is unique, and the table is not stale", () => {
  const codes = new Set();
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/);
    assert.ok(!codes.has(c.code), c.code);
    codes.add(c.code);
    assert.ok(c.emergency, `${c.code} has no emergency number`);
    assert.ok(c.lines.length, `${c.code} has no lines`);
    for (const l of [...c.lines, ...(c.abuse || [])]) {
      assert.match(l.url, /^https:\/\//, `${c.code} ${l.name}`);
      assert.ok(l.phone || l.text || l.chat, `${c.code} ${l.name} has no way to reach it`);
    }
    assert.ok(c.abuse?.length, `${c.code} has no domestic abuse service`);
  }
  for (const code of Object.values(COUNTRY_ALIASES)) assert.ok(codes.has(code), `alias points at ${code}`);
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) assert.equal(findCountry(alias)?.code, code, alias);
  for (const typed of ["UK", "U.K.", "nl", "South Africa"]) assert.ok(findCountry(typed), typed);
  assert.ok(DIRECTORIES.some((d) => d.url === "https://findahelpline.com/"));
  // Fails CI a year after the last check, so a stale number can't ship quietly.
  const age = (Date.now() - Date.parse(CHECKED)) / 86_400_000;
  assert.ok(age >= 0 && age < 365, `crisis lines last checked ${CHECKED}; re-verify them (README, "Crisis lines")`);
});

test("everything a person or the model reads follows the house style", async () => {
  const { readFile } = await import("node:fs/promises");
  const { TOOLS } = await import("../src/tools.js");
  const { PROMPTS } = await import("../src/prompts.js");
  const { INSTRUCTIONS } = await import("../src/server.js");
  const { PRIVACY_TXT, guideMarkdown } = await import("../src/pages.js");
  const letThem = await import("../src/content/let-them.js");
  const corpus = {
    content: JSON.stringify([SKILLS, EMOTIONS, SITUATIONS.map(({ requires, match, ...s }) => s), MAPPINGS, EXCEPTIONS, FLOW, COUNTRIES, letThem.LET_THEM, letThem.ATTRIBUTION, letThem.DISCLAIMER, letThem.TRADEMARK]),
    surface: JSON.stringify([INSTRUCTIONS, TOOLS.map(({ handler, ...t }) => t), PROMPTS.map((p) => [p.title, p.description, p.render({})]), PRIVACY_TXT, guideMarkdown(TOOLS, PROMPTS)]),
    readme: await readFile(new URL("../README.md", import.meta.url), "utf8"),
    skill: await readFile(new URL("../plugin/skills/wise-mind/SKILL.md", import.meta.url), "utf8"),
  };
  for (const [name, text] of Object.entries(corpus)) {
    assert.doesNotMatch(text, /—/, `${name}: an em dash slipped in`);
    assert.doesNotMatch(text, / – | - (?=[a-z])/, `${name}: a spaced dash stands in for an em dash`);
    assert.doesNotMatch(text, /[‘’“”]/, `${name}: a curly quote slipped in`);
    const banned = /\b(comprehensive|robust|seamless(ly)?|leverag\w*|delve|ensur(e|es|ed|ing)|crucial|utilis\w*|utiliz\w*|worth noting|generally speaking|in essence|essentially)\b/i.exec(text);
    assert.equal(banned, null, `${name}: "${banned?.[0]}" is on the banned list`);
  }
});

test("the README's counts match the content", async () => {
  const { readFile } = await import("node:fs/promises");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const [claim, n] of [["skill in full (", SKILLS.length], ["situation playbooks", SITUATIONS.length], ["countries, and directories", COUNTRIES.length], ["DBT skills: every skill", SKILLS.length]]) {
    const at = readme.indexOf(claim);
    assert.ok(at >= 0, `README no longer says "${claim}"`);
    const window = readme.slice(Math.max(0, at - 40), at + claim.length + 20);
    assert.match(window, new RegExp(`\\b${n}\\b`), `README count near "${claim}" is not ${n}`);
  }
});

// Dependabot bumps wrangler in the lockfile but never the deploy's pinned version, so a
// bump that forgets deploy.yml fails here instead of splitting CI from `npm run bindings`.
test("CI deploys with the Wrangler that package-lock.json pins", async () => {
  const { readFile } = await import("node:fs/promises");
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  const deploy = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.equal(/cloudflare-wrangler-version: '([^']+)'/.exec(deploy)?.[1], lock.packages["node_modules/wrangler"].version);
});
