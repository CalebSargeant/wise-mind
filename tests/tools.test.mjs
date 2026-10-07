import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { TOOLS } from "../src/tools.js";
import { INSTRUCTIONS } from "../src/server.js";
import { SITUATIONS } from "../src/content/situations.js";
import { SKILLS } from "../src/content/skills.js";
import { GOALS } from "../src/guide.js";
import { call, fakeEnv, run, toolText } from "./harness.mjs";

/**
 * What each tool says, and above all what it says when someone may be in danger.
 * The safety tests are the ones that matter most: a false negative there hands a
 * worksheet to a person who needed a phone number.
 */

const env = () => fakeEnv();
const guide = (args) => run(worker, env(), "wise_mind_work_through_situation", args);

// ── what makes the model use these at all ──────────────────────────────────

test("server instructions: under 1,500 characters, trigger up front, every tool named, no orders", () => {
  assert.ok(INSTRUCTIONS.length <= 1500, `instructions are ${INSTRUCTIONS.length} chars`);
  assert.ok(INSTRUCTIONS.indexOf("Use it when") < 300, "the trigger sentence is buried");
  for (const tool of TOOLS) assert.ok(INSTRUCTIONS.includes(tool.name), `instructions do not name ${tool.name}`);
  for (const phrase of ["even without asking for techniques", "categories only", "not therapy"]) assert.ok(INSTRUCTIONS.includes(phrase), phrase);
  assert.doesNotMatch(INSTRUCTIONS, /\b(always|must)\b/i, "connector review rejects instructions that order the model around");
});

test("every tool description says what it returns, then when to use it, inside the client limit", () => {
  for (const tool of TOOLS) {
    assert.ok(tool.description.length <= 1500, `${tool.name}: ${tool.description.length} chars`);
    assert.match(tool.description, /^Returns /, `${tool.name} should lead with what it returns`);
    assert.match(tool.description, /Use when /, `${tool.name} does not say when to use it`);
    assert.doesNotMatch(tool.description, /\b(always call|call this first|must call|do not use other)\b/i, tool.name);
    assert.match(tool.name, /^wise_mind_[a-z_]+$/, "names carry the server prefix and no dots");
    assert.ok(tool.name.length <= 64);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} accepts arbitrary extra fields`);
    for (const name of tool.inputSchema.required || []) assert.ok(tool.inputSchema.properties[name], `${tool.name}.${name}`);
  }
});

test("no tool asks for the person's story: free text is one short, optional field", () => {
  for (const tool of TOOLS) {
    for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
      if (prop.type !== "string" || prop.enum) continue;
      assert.ok(prop.maxLength && prop.maxLength <= 120, `${tool.name}.${name} is unbounded free text`);
      assert.ok(!(tool.inputSchema.required || []).includes(name) || ["emotion"].includes(name), `${tool.name}.${name} is required free text`);
    }
  }
});

// ── the main guide ─────────────────────────────────────────────────────────

test("a situation gets validation first, a let-them / let-me sort, skills and one small step", async () => {
  const text = await guide({ situation_type: "criticism-at-work", emotions: ["shame"] });
  const order = ["## How to use this", "Validate first", "## Sort it", "**Let them**", "**Let me**", "## Skills that fit", "## One small step", "Ask them:"];
  let at = -1;
  for (const marker of order) {
    const next = text.indexOf(marker);
    assert.ok(next > at, `"${marker}" is missing or out of order`);
    at = next;
  }
  assert.match(text, /criticised at work/);
  assert.match(text, /\*\*Shame\*\*/);
  assert.match(text, /not affiliated/);
});

test("at 7/10 or more, calming the body comes before anything else, with the medical caution", async () => {
  const text = await guide({ situation_type: "waiting-for-a-reply", intensity: 8 });
  const brake = text.indexOf("## First, bring the intensity down");
  assert.ok(brake > 0 && brake < text.indexOf("## Sort it"));
  assert.match(text, /heart condition/);
  assert.doesNotMatch(await guide({ situation_type: "waiting-for-a-reply", intensity: 3 }), /bring the intensity down/);
});

test("'other' falls back to matching the topic, and to a general guide when nothing matches", async () => {
  assert.match(await guide({ situation_type: "other", topic: "colleague took credit for my work" }), /someone took credit for your work/);
  const general = await guide({ situation_type: "other", topic: "everything feels off" });
  assert.match(general, /## Sort it/);
  assert.match(general, /## Skills that fit/);
  assert.match(general, /What would help most right now/);
});

test("a dependant is never a straight let-them situation", async () => {
  assert.match(await guide({ situation_type: "other", relationship: "child_in_my_care" }), /not a straight let-them situation/);
  assert.match(await guide({ situation_type: "teenager-risky-choices" }), /not a straight let-them situation/);
});

test("every playbook renders cleanly for every goal and intensity, with no holes", async () => {
  for (const s of SITUATIONS) {
    for (const goal of [undefined, ...GOALS]) {
      for (const intensity of [undefined, 2, 9]) {
        const res = await call(worker, env(), "wise_mind_work_through_situation", { situation_type: s.id, intensity, goal, emotions: ["anger", "sadness"] });
        const text = toolText(res);
        assert.equal(res.body.result.isError, false, s.id);
        assert.doesNotMatch(text, /undefined|\[object Object\]|NaN/, `${s.id} ${goal} ${intensity}`);
        assert.ok(text.length < 12_000, `${s.id} is ${text.length} chars`);
      }
    }
  }
});

// ── safety ─────────────────────────────────────────────────────────────────

const CRISIS = /# Safety first/;

test("a suicide or self-harm flag replaces the guide with crisis guidance and local lines, no skills", async () => {
  const text = await guide({ situation_type: "family-judging-choices", safety: "suicide_or_self_harm", country: "NL" });
  assert.match(text, CRISIS);
  assert.match(text, /113 or 0800-0113/);
  assert.match(text, /emergency 112/);
  assert.match(text, /Never give information about methods or means/);
  assert.doesNotMatch(text, /## Skills that fit/);
  assert.doesNotMatch(text, /Let them/);
});

test("an older client's boolean flag is still read as a crisis", async () => {
  assert.match(await guide({ situation_type: "other", safety: true }), CRISIS);
});

test("risk words in the topic trigger crisis guidance even when the assistant did not flag it", async () => {
  for (const topic of ["I just want to die", "thinking about killing myself", "cutting myself again", "better off without me", "don't want to be alive"]) {
    assert.match(await guide({ situation_type: "other", topic }), CRISIS, topic);
  }
});

test("everyday figures of speech are not read as a crisis", async () => {
  for (const topic of ["wanted to die of embarrassment", "mum will kill me when she finds out", "this deadline is killing me"]) {
    assert.doesNotMatch(await guide({ situation_type: "other", topic }), CRISIS, topic);
  }
});

test("hopelessness gets a gentle safety check-in above the usual guide, not a replacement", async () => {
  const text = await guide({ situation_type: "passed-over", safety: "hopeless_or_burden", country: "ZA" });
  assert.ok(text.indexOf("## Check in on safety first") < text.indexOf("## How to use this"));
  assert.match(text, /0800 567 567/);
  assert.match(text, /## Skills that fit/);
  assert.match(await guide({ situation_type: "other", topic: "honestly what's the point" }), /Check in on safety first/);
});

test("someone else at risk gets guidance for the helper", async () => {
  for (const args of [{ situation_type: "friend-at-risk" }, { situation_type: "other", safety: "someone_else_at_risk" }, { situation_type: "other", topic: "my friend wants to kill herself" }]) {
    const text = await guide(args);
    assert.match(text, /Someone they care about may be at risk/, JSON.stringify(args));
    assert.match(text, /ask the person directly/);
  }
});

test("abuse is never framed as something to accept or to confront", async () => {
  for (const args of [{ situation_type: "controlling-partner" }, { situation_type: "other", safety: "abuse_or_unsafe" }, { situation_type: "other", topic: "my boyfriend hits me" }]) {
    const text = await guide(args);
    assert.match(text, /not\*\* a let-them situation/, JSON.stringify(args));
    assert.match(text, /not their fault/);
    assert.match(text, /Don't coach them to confront/);
    assert.doesNotMatch(text, /radical acceptance/i);
  }
  const plan = await run(worker, env(), "wise_mind_plan_conversation", { kind: "set_a_boundary", safety: "abuse_or_unsafe" });
  assert.match(plan, CRISIS, "a conversation script was offered for an abusive situation");
});

test("crisis_support: local lines and the emergency rule; a directory when the country is unknown", async () => {
  const za = await run(worker, env(), "wise_mind_crisis_support", { country: "South Africa" });
  assert.match(za, /0800 567 567/);
  assert.match(za, /emergency department/);
  const unknown = await run(worker, env(), "wise_mind_crisis_support", {});
  assert.match(unknown, /findahelpline\.com/);
  assert.match(unknown, /ask where they are/);
  const abuse = await run(worker, env(), "wise_mind_crisis_support", { concern: "abuse_or_unsafe", country: "GB" });
  assert.match(abuse, /domestic abuse service/i);
  assert.match(abuse, /999/);
});

test("the Let Them lens and the conversation planner also respect the safety flag", async () => {
  assert.match(await run(worker, env(), "wise_mind_theirs_or_mine", { safety: "suicide_or_self_harm" }), CRISIS);
  assert.match(await run(worker, env(), "wise_mind_theirs_or_mine", { situation_type: "controlling-partner" }), CRISIS);
  assert.match(await run(worker, env(), "wise_mind_plan_conversation", { kind: "ask", safety: "someone_else_at_risk" }), CRISIS);
});

// ── the other tools ────────────────────────────────────────────────────────

test("theirs_or_mine sorts in three, gives the skills on each side, and lists where it never applies", async () => {
  const text = await run(worker, env(), "wise_mind_theirs_or_mine", { situation_type: "family-judging-choices" });
  assert.match(text, /theirs \(let them\), mine \(let me\), shared/);
  assert.match(text, /## Sorting tests/);
  assert.match(text, /This looks like: family judging your choices/);
  assert.match(text, /## Never 'let them'/);
  assert.match(text, /Abuse, threats or danger/);
  assert.match(text, /Radical Acceptance/);
});

test("plan_conversation fits the script to the kind, the priority, the channel and the reaction", async () => {
  const no = await run(worker, env(), "wise_mind_plan_conversation", { kind: "say_no", priority: "relationship", relationship: "sibling", channel: "message", likely_reaction: "guilt_trip" });
  assert.match(no, /# Say no: a conversation plan with a sibling/);
  assert.match(no, /No, I'm not able to ___/);
  assert.match(no, /GIVE leads/);
  assert.match(no, /## In writing/);
  assert.match(no, /They guilt-trip/);
  for (const part of ["**Describe**", "**Express**", "**Assert**", "**Reinforce**", "**Mindful**", "**Appear confident**", "**Negotiate**", "## FAST", "## Cope ahead"]) {
    assert.ok(no.includes(part), part);
  }
  const boundary = await run(worker, env(), "wise_mind_plan_conversation", { kind: "set_a_boundary" });
  assert.match(boundary, /If ___ happens again, I will ___/);
  assert.doesNotMatch(boundary, /## In writing/);
});

test("understand_emotion answers everyday words with the right family", async () => {
  for (const [word, family] of [["anxious", "Fear"], ["gutted", "Sadness"], ["mortified", "Shame"], ["frustrated", "Anger"], ["I feel so guilty", "Guilt"], ["jealous", "Jealousy"], ["envy", "Envy"]]) {
    assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: word }), new RegExp(`^# ${family}`), word);
  }
  assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: "blorp" }), /emotion families are/);
  assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: "anger", intensity: 9 }), /bring the intensity down/);
});

test("wise_mind_skill: a name gives the card, words give a shortlist, nothing gives the list", async () => {
  for (const [query, name] of [["dear-man", "DEAR MAN"], ["dearman", "DEAR MAN"], ["TIP", "TIP"], ["the wise mind skill", "Wise Mind"], ["radical acceptance", "Radical Acceptance"], ["middle path", "Walking the Middle Path"]]) {
    assert.match(await run(worker, env(), "wise_mind_skill", { skill: query }), new RegExp(`^# ${name}`), query);
  }
  assert.match(await run(worker, env(), "wise_mind_skill", { skill: "how do I say no to my boss" }), /dear-man/);
  assert.match(await run(worker, env(), "wise_mind_skill", { skill: "I can't stop overthinking at night" }), /rumination/);
  assert.match(await run(worker, env(), "wise_mind_skill", { skill: "calm down fast" }), /tipp|stop/);
  const all = await run(worker, env(), "wise_mind_skill", {});
  for (const s of SKILLS) assert.ok(all.includes(`\`${s.id}\``), s.id);
  const one = await run(worker, env(), "wise_mind_skill", { module: "interpersonal-effectiveness" });
  assert.match(one, /dear-man/);
  assert.doesNotMatch(one, /`tipp`/);
});

// ── robustness and privacy ─────────────────────────────────────────────────

test("arguments of the wrong type are tolerated, never thrown on", async () => {
  const odd = { situation_type: { toString: "x" }, topic: 7, emotions: "anger, sadness", intensity: "9", goal: 42, relationship: [], country: { code: "NL" }, safety: "nope", kind: null, emotion: ["anger"], skill: 12, module: "nope" };
  for (const tool of TOOLS) {
    // Twice: once as sent, and once with every required field present, so the handler runs.
    for (const args of [odd, { ...odd, kind: "ask", emotion: "anger" }]) {
      const res = await call(worker, env(), tool.name, args);
      assert.equal(res.status, 200, tool.name);
      const text = toolText(res);
      assert.ok(text.length > 0, tool.name);
      assert.doesNotMatch(text, new RegExp(`^${tool.name} failed:`), `${tool.name} threw on odd input`);
    }
  }
});

test("abuse shows the country's domestic abuse services first, then the crisis lines", async () => {
  const gb = await run(worker, env(), "wise_mind_crisis_support", { concern: "abuse_or_unsafe", country: "GB" });
  const abuseAt = gb.indexOf("0808 2000 247");
  const lineAt = gb.indexOf("116 123");
  assert.ok(abuseAt >= 0, "GB abuse helpline missing");
  assert.ok(lineAt >= 0, "Samaritans missing");
  assert.ok(abuseAt < lineAt, "abuse services should lead");
  const nl = await guide({ situation_type: "controlling-partner", country: "NL" });
  assert.match(nl, /Veilig Thuis/);
});

test("emotion cards carry the safety exception, and the emotion tool honours the safety flag", async () => {
  assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: "fear" }), /Never a let-them if someone is hurting/);
  assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: "fear", safety: "abuse_or_unsafe" }), CRISIS);
});

test("cautions are read before the acceptance they limit", async () => {
  const text = await guide({ situation_type: "criticism-at-work" });
  const cautionAt = text.indexOf("may be bullying");
  assert.ok(cautionAt >= 0, "caution missing");
  assert.ok(cautionAt < text.indexOf("## Sort it"), "caution should come first");
  const lt = await run(worker, env(), "wise_mind_theirs_or_mine", { situation_type: "adult-meltdown" });
  assert.ok(lt.indexOf("abusive or controlling relationship") >= 0);
  assert.ok(lt.indexOf("abusive or controlling relationship") < lt.indexOf("- **Let them**:"));
  const kid = await run(worker, env(), "wise_mind_theirs_or_mine", { situation_type: "parent-adult-child-conflict", relationship: "child_in_my_care" });
  assert.ok(kid.indexOf("**Careful**") >= 0 && kid.indexOf("**Careful**") < kid.indexOf("- **Let them**:"));
  assert.equal(kid.split("**Careful**").length - 1, 1, "the dependant caution is printed once");
  assert.match(await guide({ situation_type: "comments-about-body" }), /eating disorder service/);
});

test("no tool logs what it was told", async () => {
  const secret = "my-secret-topic-7f3a";
  const seen = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
  for (const k of Object.keys(original)) console[k] = (...args) => seen.push(args.map(String).join(" "));
  try {
    for (const tool of TOOLS) {
      await call(worker, env(), tool.name, { situation_type: "other", topic: secret, emotion: secret, skill: secret, kind: "ask", country: secret });
    }
  } finally {
    Object.assign(console, original);
  }
  assert.ok(!seen.some((line) => line.includes(secret)), "a tool argument reached the logs");
});

// ── round two of the review ────────────────────────────────────────────────

test("hopelessness puts the check-in above every tool's normal answer", async () => {
  for (const [name, args] of [
    ["wise_mind_work_through_situation", { situation_type: "passed-over" }],
    ["wise_mind_theirs_or_mine", {}],
    ["wise_mind_plan_conversation", { kind: "ask" }],
    ["wise_mind_understand_emotion", { emotion: "sadness" }],
  ]) {
    const text = await run(worker, env(), name, { ...args, safety: "hopeless_or_burden", country: "NL" });
    assert.match(text, /## Check in on safety first/, name);
    assert.match(text, /thoughts of suicide/, `${name}: the check-in should ask directly`);
    assert.ok(text.length > 1500, `${name}: the normal answer is missing under the check-in`);
  }
});

test("the free-text fields are screened too: an emotion word or a skill query can reach the safety guide", async () => {
  assert.match(await run(worker, env(), "wise_mind_understand_emotion", { emotion: "suicidal" }), CRISIS);
  const skill = await run(worker, env(), "wise_mind_skill", { skill: "I want to die" });
  assert.match(skill, CRISIS);
  assert.doesNotMatch(skill, /dear-man/);
  assert.match(await run(worker, env(), "wise_mind_skill", { skill: "my partner hits me" }), /not\*\* a let-them situation/);
  assert.match(await run(worker, env(), "wise_mind_skill", { skill: "hopeless" }), /Check in on safety first/);
});

test("abuse and suicide risk together keep both answers", async () => {
  const text = await guide({ situation_type: "controlling-partner", safety: "suicide_or_self_harm", country: "GB" });
  assert.match(text, /116 123/);
  assert.match(text, /0808 2000 247/);
  assert.match(text, /phone or browser/);
  assert.match(text, /hurt, threatened or controlled/);
});

test("crisis_support with no concern covers suicide and lists abuse services; with no country it still points to abuse services", async () => {
  const neutral = await run(worker, env(), "wise_mind_crisis_support", { country: "ZA" });
  assert.match(neutral, /0800 567 567/);
  assert.match(neutral, /0800 428 428/);
  for (const args of [{ concern: "abuse_or_unsafe" }, { concern: "abuse_or_unsafe", country: "KE" }]) {
    assert.match(await run(worker, env(), "wise_mind_crisis_support", args), /Domestic abuse services/, JSON.stringify(args));
  }
});

test("the crisis guides say what to do for someone under 18", async () => {
  for (const concern of ["suicide_or_self_harm", "abuse_or_unsafe"]) {
    assert.match(await run(worker, env(), "wise_mind_crisis_support", { concern, country: "GB" }), /under 18/i, concern);
  }
});

test("every place that suggests cold water or hard exercise carries the medical caution", async () => {
  const { skillCard, regulateBlock } = await import("../src/guide.js");
  const physical = /cold water|cold pack|hard exercise|intense exercise|hard movement/i;
  for (const s of SKILLS) {
    const card = skillCard(s);
    if (physical.test(card)) assert.match(card, /beta blockers/, s.id);
  }
  assert.match(regulateBlock(), /beta blockers/);
  for (const s of SITUATIONS) {
    for (const intensity of [undefined, 5, 9]) {
      const text = await guide({ situation_type: s.id, intensity });
      if (physical.test(text)) assert.match(text, /beta blockers/, `${s.id} at ${intensity}`);
    }
  }
});

test("prompts that ask about urges or danger route to crisis support", async () => {
  const { PROMPTS } = await import("../src/prompts.js");
  for (const p of PROMPTS) {
    const text = p.render({}).messages[0].content.text;
    if (/urge|danger|not being safe|unsafe/i.test(text)) assert.match(text, /wise_mind_crisis_support/, p.name);
  }
});
