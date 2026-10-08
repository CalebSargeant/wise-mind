/**
 * The engine: lookups over the bundled content, the safety screen, and the
 * builders that turn a situation into a short guide the assistant can blend into
 * its own reply.
 *
 * ── WHO READS THIS OUTPUT ───────────────────────────────────────────────────
 *
 * The assistant, not the person. Every guide opens with how to use it (validate
 * first, your own words, one or two skills rather than a menu), because the
 * failure mode of a skills server is an assistant pasting a worksheet at someone
 * who is hurting. The guides are condensed; wise_mind_skill has the full cards.
 *
 * ── CATEGORIES IN, NOT STORIES ──────────────────────────────────────────────
 *
 * The tools take categories (a situation type, an emotion family, a number), so a
 * person's story never has to leave their conversation. The one free-text field
 * left (`topic`, for situations no playbook covers) is a few words, and it still
 * goes through the safety screen.
 *
 * ── SAFETY BEFORE EVERYTHING ────────────────────────────────────────────────
 *
 * Four levels, from the assistant's flag or from the words themselves:
 *
 *   suicide_or_self_harm   the guide is replaced by crisis guidance and lines
 *   someone_else_at_risk   the same, written for the person helping
 *   abuse_or_unsafe        safety and support; never "let them", never "confront"
 *   hopeless_or_burden     a gentle safety check-in BEFORE the usual guide
 *
 * In the first three no skill menu is offered: a person in danger needs people and
 * a phone number, not a worksheet. None of this replaces the assistant's own
 * crisis handling; it adds local numbers and keeps the skills out of the way.
 */

import { MODULES, SKILLS } from "./content/skills.js";
import { EMOTIONS } from "./content/emotions.js";
import { SITUATIONS } from "./content/situations.js";
import { ATTRIBUTION, DISCLAIMER, EXCEPTIONS, LET_THEM, MAPPINGS } from "./content/let-them.js";
import { CHECKED, COUNTRIES, COUNTRY_ALIASES, DIRECTORIES, EMERGENCY_RULE } from "./content/crisis.js";

// ── small helpers ──────────────────────────────────────────────────────────

/** A tool argument as a bounded, trimmed string, whatever the client sent. */
export function str(value, max = 2000) {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** A tool argument as a list of bounded strings. A single string becomes a list. */
export function list(value, max = 12) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]/) : [];
  return items.map((v) => str(v, 200)).filter(Boolean).slice(0, max);
}

/** An integer in [lo, hi], or null when absent or unreadable. */
export function int(value, lo, hi) {
  const n = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** One of `allowed`, or null. */
export const oneOf = (value, allowed) => (allowed.includes(value) ? value : null);

export const norm = (text) =>
  str(text, 4000)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'");

const key = (text) => norm(text).replace(/[^a-z0-9]+/g, "");
const bullets = (items) => items.map((i) => `- ${i}`).join("\n");
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));
const SITUATION_BY_ID = new Map(SITUATIONS.map((s) => [s.id, s]));

// ── vocabularies the tools advertise ───────────────────────────────────────

export const SAFETY = ["none", "hopeless_or_burden", "suicide_or_self_harm", "abuse_or_unsafe", "someone_else_at_risk"];
export const GOALS = ["calm_down", "understand_it", "decide_what_to_do", "talk_to_them", "set_a_boundary", "let_it_go", "move_forward"];
export const RELATIONSHIPS = ["partner", "ex", "date", "parent", "in_law", "adult_child", "child_in_my_care", "sibling", "family", "friend", "manager", "colleague", "client", "housemate", "stranger", "self", "other"];

/** How each relationship reads in a heading ("with a manager", "with an ex"). */
const WHO = { ex: "an ex", in_law: "an in-law", adult_child: "an adult child", child_in_my_care: "a child in your care", family: "family", self: "", other: "" };
const withWhom = (relationship) => {
  if (!relationship) return "";
  const phrase = relationship in WHO ? WHO[relationship] : `a ${relationship.replace(/_/g, " ")}`;
  return phrase ? ` with ${phrase}` : "";
};
export const CONVERSATION_KINDS = ["ask", "say_no", "set_a_boundary", "raise_a_problem", "repair"];
export const PRIORITIES = ["objective", "relationship", "self_respect"];
export const CHANNELS = ["in_person", "message", "call"];
export const REACTIONS = ["agree", "push_back", "get_angry", "guilt_trip", "go_quiet", "unsure"];
export const EMOTION_IDS = EMOTIONS.map((e) => e.id);

/**
 * The safety level from the assistant's flag. `true` from an older client is
 * read as the highest general level: an ambiguous yes is still a yes.
 */
export function safetyLevel(value) {
  if (value === true || value === "true") return "suicide_or_self_harm";
  return oneOf(value, SAFETY) || "none";
}

// ── lookups ────────────────────────────────────────────────────────────────

/** Every name a skill answers to, squashed to letters and digits. */
function skillKeys(skill) {
  const keys = new Set([key(skill.id), key(skill.name), ...skill.aliases.map(key)]);
  if (skill.acronym?.length) keys.add(key(skill.acronym.map((a) => a.letter).join("")));
  const paren = /\(([^)]+)\)/.exec(skill.name);
  if (paren) keys.add(key(skill.name.replace(paren[0], "")));
  keys.delete("");
  return keys;
}

const SKILL_KEYS = SKILLS.map((s) => [s, skillKeys(s)]);

/** One skill by id, name, acronym or alias; null when nothing matches exactly. */
export function findSkill(query) {
  const k = key(query);
  if (!k) return null;
  for (const [skill, keys] of SKILL_KEYS) if (keys.has(k)) return skill;
  const trimmed = key(norm(query).replace(/\b(the|skill|skills|dbt|technique|exercise|how to|use)\b/g, ""));
  if (trimmed && trimmed !== k) for (const [skill, keys] of SKILL_KEYS) if (keys.has(trimmed)) return skill;
  return null;
}

/** One emotion family by name or by the everyday word for it. */
export function findEmotion(word) {
  const w = norm(word).replace(/^(i'?m |i am |i feel |feeling |so |really |very )+/g, "").trim();
  if (!w) return null;
  for (const e of EMOTIONS) if (e.id === w || norm(e.name) === w) return e;
  for (const e of EMOTIONS) if (e.aliases.some((a) => norm(a) === w)) return e;
  for (const e of EMOTIONS) if (e.aliases.some((a) => a.length > 3 && w.includes(norm(a)))) return e;
  return null;
}

/** Emotion families named anywhere in a piece of text. */
export function emotionsIn(text) {
  const t = ` ${norm(text)} `;
  return EMOTIONS.filter((e) =>
    [e.id, norm(e.name), ...e.aliases.map(norm)].some((w) => new RegExp(`[^a-z]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(t)),
  );
}

/** A country from a code, a name or a common spelling; null when unknown. */
export function findCountry(value) {
  const v = norm(value).replace(/[.]/g, "").trim();
  if (!v) return null;
  // Names first, so "UK" (an alias, not an ISO code) still finds GB.
  const code = (Object.hasOwn(COUNTRY_ALIASES, v) ? COUNTRY_ALIASES[v] : null) || (v.length === 2 ? v.toUpperCase() : null);
  return COUNTRIES.find((c) => c.code === code) || null;
}

export function situationById(id) {
  return SITUATION_BY_ID.get(norm(id).replace(/_/g, "-").replace(/[^a-z0-9-]/g, "")) || null;
}

/**
 * A playbook, corrected for who the other person is: a conflict with a child in
 * the person's care is never the adult-child playbook, whose "let them make their
 * own adult decisions" would be the wrong advice.
 */
function forRelationship(situation, relationship) {
  if (situation?.id === "parent-adult-child-conflict" && relationship === "child_in_my_care") return SITUATION_BY_ID.get("teenager-risky-choices");
  return situation;
}

/** The safety level a playbook implies on its own. */
const safetyOf = (situation) =>
  situation?.id === "friend-at-risk" ? "someone_else_at_risk" : situation?.id === "controlling-partner" ? "abuse_or_unsafe" : "none";

/** Abuse riding along with a worse level, so its guidance isn't dropped. */
const abuseAlongside = (safety, topic, matched) => safety === "abuse_or_unsafe" || mentionsAbuse(topic) || matched?.id === "controlling-partner";

/**
 * The emotion card, behind the same safety screen as everything else: the word
 * itself is screened, a crisis replaces the card, and hopelessness puts the
 * check-in above it.
 */
export function emotionGuide({ word = "", intensity = null, safety = "none", country = null }) {
  const level = worst(safety, screen(word));
  if (replacesGuide(level)) return crisisGuide(level, country, { abuse: safety === "abuse_or_unsafe" || mentionsAbuse(word) });
  const emotion = findEmotion(word);
  const body = emotion
    ? emotionCard(emotion, { intensity })
    : `# No card for "${word}"\n\nThe emotion families are: ${EMOTION_IDS.join(", ")}. ` +
      "Pick the closest (anxious and worried are fear, hurt and lonely are sadness, embarrassed is shame, frustrated is anger) and call again. " +
      "If the word points at risk (wanting to die, feeling like a burden, feeling unsafe), call again with `safety` set, or use wise_mind_crisis_support.";
  return level === "hopeless_or_burden" ? withCheckIn(body, country) : body;
}

/** Situations a few words point at, best first. Every `requires` must hit; each `match` adds a point. */
export function matchSituations(text) {
  const t = norm(text);
  if (!t) return [];
  const scored = [];
  for (const s of SITUATIONS) {
    if (!s.requires.every((r) => r.test(t))) continue;
    scored.push({ situation: s, score: s.requires.length * 2 + s.match.filter((m) => m.test(t)).length });
  }
  // Safety playbooks first, whatever else scored: a topic that reads as abuse or as
  // someone at risk must reach the safety guide even when an ordinary playbook
  // matched more words. Then score. On a tie, the playbook that does NOT offer
  // plain acceptance wins: a wrong "careful" costs a paragraph, a wrong "let them"
  // can cost far more.
  const safe = (s) => Number(Boolean(s.safety));
  const careful = (s) => Number(Boolean(s.notLetThem || s.safety));
  return scored.sort((a, b) => safe(b.situation) - safe(a.situation) || b.score - a.score || careful(b.situation) - careful(a.situation));
}

// ── the safety screen ──────────────────────────────────────────────────────

// "live" and "living" only count when nothing ordinary follows: "don't want to live
// with my sister" is a housing problem.
const LIVE = "live(?! (with|in|at|near|next|under|together|abroad|there|here|on|off|out)\\b)";

const SELF_HARM = new RegExp(
  [
    "suicid",
    "kill(ing)? myself",
    "end(ing)? (my life|it all)",
    "take my (own )?life",
    "want(ed)? to die(?! (of|from|laughing))",
    "wanna die",
    "wish i (was|were) dead",
    "wish i (wasn'?t|weren'?t|was not|were not) (here|alive|born)",
    `(don't|do not|dont|not|never) want(ing)? to (${LIVE}|be alive|be here|exist|wake up)`,
    `tired of (being alive|living(?! (with|in|at|near|next|under|together|abroad|there|here|on|off|out)\\b))`,
    "sleep and (never|not) wake up",
    "better off (dead|without me)",
    "no (reason|point) (to|in) (live|living|going on|being alive)",
    "\\bunaliv",
    "(?<![0-9] ?)\\bkms\\b",
    "self[- ]?harm",
    "(cut|cutting|hurt|hurting|harm|harming) myself",
    "(harmed|burned|burnt|burning|burn) myself(?! (on|with|while|cooking|making|accidentally|by accident)\\b)",
    "relaps\\w* (and|into|on) (cut|self)",
    "overdos",
    "(take|took|taken|taking|swallow(ed|ing)?) (all (of )?|too many |\\d+ |a (lot|bunch|handful|bottle|box|packet) of )(my |the |those |these )?(pills|tablets|meds|medication|painkillers|paracetamol)",
    "hang myself",
    "jump (off|in front)",
  ].join("|"),
);

const PEOPLE = "partner|husband|wife|boyfriend|girlfriend|spouse|ex|dad|father|mum|mom|mother|step\\w+|brother|sister|son|daughter|uncle|aunt|parents?";

const ABUSE = new RegExp(
  [
    // Not "it hit me that..." or "reality hit me": figures of speech.
    "(?<!\\b(it|that|this|reality|the news) )(hit|hits|hitting|beat|beats|beating|punch(es|ed)?|kick(s|ed)?|slap(s|ped)?|chok(e|es|ed|ing)|strangl\\w*|shov(e|es|ed)) me\\b",
    // "pushed me to apply" is encouragement; "pushed me to the ground" is not.
    "(?<!\\b(it|that|this|reality|the news) )push(es|ed)? me\\b(?! to (apply|quit|study|change|breaking point|my limit)\\b)",
    "rap(e|ed|ing)\\b",
    "sexual(ly)? assault",
    "molest",
    "forc(e|es|ed) me",
    "threaten(s|ed|ing)? (me|to (hurt|kill|take))",
    "abus(e|es|ed|ive)\\b",
    "abusing (me|us|the (kids|children)|my (kids|children|son|daughter))\\b",
    "coerc",
    "domestic (violence|abuse)",
    "stalk(s|ed|ing)?",
    "(afraid|scared|fear) (of|for) my (life|safety)",
    "(not|un)safe at home",
    "(don'?t|do not|never) feel safe (at home|around (him|her|them|my \\w+))",
    `\\b(afraid|scared|frightened|terrified) of my (${PEOPLE})\\b(?!'s\\b|s'|[- ]in[- ]law\\b| (?!(hurting|hitting|beating|attacking|killing|coming home)\\b)\\w+ing\\b)`,
    "\\b(afraid|scared|frightened|terrified) (of going|to go) home\\b(?! for\\b)",
    "\\b(frightened|scared|afraid|terrified) at home",
    "(scream|yell|shout)(s|ed|ing)? at me\\b[^.]{0,60}\\b(scared|afraid|frightened|terrified)",
    `\\b(he|she|they|${PEOPLE})\\b[^.]{0,30}\\b(gets?|got|becomes?|became|turns?|turned|is|was) (violent|physical)\\b`,
    "grab(s|bed|bing)? me\\b(?! (a|an|some|one|the|lunch|coffee|tea|food|drinks?|dinner)\\b)",
    "thr(ew|ows?|owing|own) (things|stuff|objects|something|it|them|plates?|glass(es)?|cups?|mugs?|bottles?|(a|his|her|their|my|the) (plate|glass|cup|mug|bottle|phone|chair|shoe|remote|book|bag|keys|drink|vase)) at me",
    `(${PEOPLE}) (hurts?|beats?) me\\b`,
    `(${PEOPLE}|he|she) (hits?|beats?|hurts?|kicks?|slaps?) (the|our|my|his|her) (kids?|children|son|daughter|baby)\\b`,
    "controls? (my money|my phone|where i go|who i see|everything i do)",
    "won't let me (leave|see|go|have)",
  ].join("|"),
);

const HOPELESS = new RegExp(
  "\\b(hopeless|what'?s the point|no point (in|to) anything|burden (to|on) (everyone|everybody|them|my family)|i'?m a burden|can'?t go on|" +
    "can'?t do this any ?more|giving (my|all my) (stuff|things) away|nothing will ever get better|trapped|" +
    "(want|wish) (it all|everything) (to|would) (stop|end)|make (it all|everything) stop|can'?t (keep going|carry on)\\b(?! (to|with)\\b)|" +
    "want(ed)? to disappear(?! for\\b)|no way out\\b(?! of (this|the|my) (contract|deal|lease|job))|" +
    "(everyone|everybody|they|my family|the world|people) ?(would|'d) (be (fine|better|happier|okay|ok)|manage|cope|do (fine|better)) without me(?! (for|while|on|at|during)\\b))\\b",
);

const OTHER_AT_RISK =
  /\b(friend|partner|husband|wife|boyfriend|girlfriend|son|daughter|child|kid|brother|sister|mum|mom|dad|mother|father|colleague|he|she|they)\b[^.!?]{0,80}\b(suicid|kill (him|her|them)sel|end (his|her|their) life|self[- ]?harm|want(s)? to die|overdos|(cut|cutting|hurt|hurting|harm|harming) (him|her|them)sel)/;

// "My girlfriend left and I want to die" is about the speaker, not her: a first-person
// statement wins, unless another person is the subject between "I" and the words.
const OTHERS = "he|she|they|him|her|them|friend|partner|husband|wife|boyfriend|girlfriend|son|daughter|child|kid|brother|sister|mum|mom|dad|mother|father|colleague";
const FIRST_PERSON = new RegExp(
  `\\b(i|i'?m|i am|i'?ve)\\b(?:(?!\\b(${OTHERS})\\b)[^.!?,]){0,25}\\b(want(ed)? to die|wanna die|(don'?t|do not|dont) want to (live|be alive|be here|exist|wake up)|wish i (was|were) dead|kill(ing)? myself|end(ing)? my life|suicid|self[- ]?harm)`,
);

/**
 * What a few words say about safety. High recall on purpose: a false positive
 * costs a careful block at the top of the answer; a false negative costs a
 * worksheet handed to someone in danger.
 */
export function screen(text) {
  const t = norm(text);
  if (!t) return "none";
  const other = OTHER_AT_RISK.test(t) && !/\bmyself\b/.test(t) && !FIRST_PERSON.test(t);
  if (SELF_HARM.test(t) && !other) return "suicide_or_self_harm";
  if (other) return "someone_else_at_risk";
  if (ABUSE.test(t)) return "abuse_or_unsafe";
  if (HOPELESS.test(t)) return "hopeless_or_burden";
  return "none";
}

/** Whether a few words describe abuse, whatever else they describe. */
export const mentionsAbuse = (text) => ABUSE.test(norm(text));

const RANK = { none: 0, hopeless_or_burden: 1, abuse_or_unsafe: 2, someone_else_at_risk: 3, suicide_or_self_harm: 4 };
/** The more serious of two safety levels. */
export const worst = (a, b) => (RANK[b] > RANK[a] ? b : a);

/** The levels whose answer replaces the guide entirely. */
export const replacesGuide = (level) => level === "suicide_or_self_harm" || level === "someone_else_at_risk" || level === "abuse_or_unsafe";

// ── crisis output ──────────────────────────────────────────────────────────

function lineText(line) {
  const parts = [line.phone && `call ${line.phone}`, line.text, line.chat && `chat: ${line.chat}`].filter(Boolean);
  return `**${line.name}**: ${parts.join("; ")}${line.hours ? ` (${line.hours})` : ""}. ${line.url}`;
}

/**
 * The lines for one country, or the directories and a prompt to ask where they
 * are. With `abuse`, domestic abuse services lead when abuse is the concern, and
 * follow the crisis lines when it rides along with a suicide risk (`abuseSecond`).
 */
export function crisisLines(country, { forOthers = false, abuse = false, abuseSecond = false } = {}) {
  if (!country) {
    return [
      "Country not known: ask where they are, or point them to a directory that lists free local lines:",
      abuse ? `- Domestic abuse services: [${DIRECTORIES[0].name}](${DIRECTORIES[0].url}) (choose their country, then the domestic violence topic). In immediate danger, the emergency number comes first.` : "",
      bullets(DIRECTORIES.map((d) => `[${d.name}](${d.url}): ${d.note}`)),
      "- Emergency numbers: 112 (EU and most mobiles), 911 (US, Canada, Mexico), 999 (UK), 000 (Australia), 111 (New Zealand).",
      `- Under 18: ${DIRECTORIES[0].url} lists child and youth helplines too.`,
      "- Pass `country` for the full local list. Covered: " + COUNTRIES.map((c) => c.code).join(", ") + ".",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const crisis = country.lines.filter((l) => forOthers || !l.forOthers);
  const services = abuse ? country.abuse || [] : [];
  const lines = abuseSecond ? [...crisis, ...services] : [...services, ...crisis];
  return [
    `**${country.name}**: emergency ${country.emergency}.`,
    bullets(lines.map(lineText)),
    abuse && !services.length ? `- Domestic abuse services in ${country.name}: ${DIRECTORIES[0].url} (filter by topic).` : "",
    `- Under 18, or elsewhere, or another language: ${DIRECTORIES[0].url} (it lists child and youth helplines too).`,
    `_Checked ${CHECKED} on each service's own site. Numbers change; the linked page is the source of truth._`,
  ]
    .filter(Boolean)
    .join("\n");
}

const TOP_OF_TURN = "This replaces the usual guide for this turn: no skills menu. It adds local numbers to your own crisis handling and never replaces it.";

const ABUSE_BULLETS = [
  "Believe them and say so plainly. Name it as not okay and not their fault.",
  "Ask whether they are safe right now. If they are in immediate danger, the emergency number comes first.",
  "For an adult: offer, don't push. A domestic abuse service can help them plan safely, including how to leave safely if and when they choose. Leaving is their decision, and planning it with an expert matters.",
  "Practical steps they control: tell one trusted person; keep a dated, private record of incidents somewhere the other person can't see; keep documents, cards and a charger where they can grab them.",
  "If the other person may check their phone or browser, suggest a device they can't reach, and mention that deleting history can also delete evidence they may want.",
  "Don't coach them to confront the person (no DEAR MAN with someone who is hurting them) and don't suggest couples counselling. Both can raise the risk.",
  "If they seem to be under 18: leaving is not on them. Help them tell a safe adult who isn't involved (a teacher, a school counsellor, another relative) and point to a child helpline. If an adult is hurting them, or a child is present, child protection or the emergency number comes first.",
];

/**
 * The safety-first answer: guidance for the assistant, then the lines. `abuse`
 * adds the abuse guidance to a suicide or someone-at-risk answer, because a person
 * can be in both situations at once and neither answer should drop the other.
 */
export function crisisGuide(level, country, { abuse = false } = {}) {
  if (level === "abuse_or_unsafe") {
    return [
      "# Safety first",
      "",
      "What they describe may be abuse, threats or control. This is **not** a let-them situation, and nothing here asks them to accept it.",
      "",
      "## How to respond",
      bullets(ABUSE_BULLETS),
      "",
      "## Where to get help",
      crisisLines(country, { abuse: true }),
    ].join("\n");
  }

  const forOthers = level === "someone_else_at_risk";
  return [
    "# Safety first",
    "",
    forOthers
      ? "Someone they care about may be at risk of suicide or self-harm. Let Them does not apply: nobody steps back from this."
      : "They may be thinking about suicide or self-harm.",
    abuse ? "They may also be hurt, threatened or controlled by someone. That is not a let-them situation either." : "",
    TOP_OF_TURN,
    "",
    "## How to respond",
    bullets(
      forOthers
        ? [
            "Take it seriously and thank them for telling you. Stay calm and warm.",
            "Encourage them to ask the person directly whether they are thinking about ending their life. Asking does not plant the idea; it opens the door.",
            "If the answer is yes, or they are unsure: don't leave the person alone if there is immediate danger, help remove access to means if it is safe to, and contact a crisis line or emergency services together.",
            "Remind them they are not responsible for fixing this alone, and that support is there for them too.",
          ]
        : [
            "Stay with them. Respond with warmth, not alarm: thank them for telling you and reflect what you hear in plain words.",
            "Ask directly and calmly whether they are thinking about ending their life, and whether they are safe right now.",
            "If there is immediate danger (they have hurt themselves, have the means at hand and intend to use them, or can't stay safe), urge them to call the emergency number now, or to tell someone nearby.",
            "Otherwise, encourage them to contact a crisis line now, while you keep talking with them. Offer to help them work out what to say.",
            "Ask who they could reach out to today: a friend, family, their GP or therapist.",
            "If they seem to be under 18: help them tell a trusted adult today (a safe parent, a teacher or school counsellor) and offer a child or youth helpline.",
            "Never give information about methods or means, don't debate whether life is worth living, and don't promise secrecy. Keep it simple and human, and hopeful: crises pass, and help works.",
          ],
    ),
    abuse ? "" : null,
    abuse ? "## Because someone may also be hurting them" : null,
    abuse ? bullets(ABUSE_BULLETS.slice(2, 6)) : null,
    "",
    "## Where to get help",
    EMERGENCY_RULE,
    "",
    crisisLines(country, { forOthers, abuse, abuseSecond: true }),
    "",
    "## If they want something to do with their body right now",
    bullets([
      "Breathe out longer than in: in for 4, out for 6 to 8, for two minutes.",
      "Hold something cold, or splash cold water on the face (skip the intense cold with a heart condition, low heart rate, beta blockers or an eating disorder).",
      "Name five things they can see and four they can hear, slowly.",
    ]),
  ]
    .filter((line) => line !== null && line !== false)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** The gentle check-in that goes ABOVE a normal guide when hopelessness shows. */
export function checkInBlock(country) {
  const first = country?.lines[0];
  return [
    "## Check in on safety first",
    "Hopelessness, feeling like a burden or 'what's the point' can sit close to suicidal thinking. Before any skills, ask gently how they are really doing, then ask directly whether they have had thoughts of suicide or of not wanting to be alive. Asking does not put the idea there; it opens the door.",
    "- If yes, or they're unsure: switch to wise_mind_crisis_support and put connection and help first.",
    `- If no: carry on below, and mention that support is there if it gets heavier${first ? ` (in ${country.name}: ${first.name}, ${first.phone || first.text})` : ` (${DIRECTORIES[0].url})`}.`,
  ].join("\n");
}

/** A guide with the check-in put under its title. */
const withCheckIn = (text, country) => {
  const [title, ...rest] = text.split("\n");
  return [title, "", checkInBlock(country), ...rest].join("\n");
};

// ── skills ─────────────────────────────────────────────────────────────────

const GOAL_SKILLS = {
  calm_down: ["tipp", "stop", "self-soothe", "mindfulness-of-current-emotion", "accepts"],
  understand_it: ["model-of-emotions", "check-the-facts", "what-skills", "self-validation"],
  decide_what_to_do: ["wise-mind", "clarifying-priorities", "pros-and-cons", "problem-solving"],
  talk_to_them: ["dear-man", "give", "fast", "clarifying-priorities", "cope-ahead"],
  set_a_boundary: ["boundary-building", "fast", "dear-man", "cope-ahead"],
  let_it_go: ["radical-acceptance", "turning-the-mind", "willingness", "self-soothe"],
  move_forward: ["problem-solving", "build-mastery", "accumulate-positives", "abc-please"],
};

/**
 * The few skills that fit, from the situation, the goal and the emotions, weighted
 * by where each appears. Above 7/10 the brakes are said separately (regulateBlock),
 * so they are left out of this list rather than said twice.
 */
export function pickSkills({ situation, goal, emotions = [], intensity = null, limit = 3 }) {
  const score = new Map();
  const add = (ids, weight) => ids.forEach((id, i) => SKILL_BY_ID.has(id) && score.set(id, (score.get(id) || 0) + weight - i * 0.1));
  if (situation) add(situation.skills, 3);
  if (goal && GOAL_SKILLS[goal]) add(GOAL_SKILLS[goal], 2.5);
  for (const e of emotions) add(e.skills, 1.5);
  if (!score.size) add(["wise-mind", "check-the-facts", "radical-acceptance", "dear-man"], 1);
  let ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => SKILL_BY_ID.get(id));
  if (intensity !== null && intensity >= 7) ranked = ranked.filter((s) => s.id !== "stop" && s.id !== "tipp");
  return ranked.slice(0, limit);
}

/** STOP and TIPP, condensed, for anyone above 7/10. */
export function regulateBlock() {
  return [
    "## First, bring the intensity down",
    "Above about 7/10, thinking narrows and the urge drives. Help them settle the body before any problem-solving:",
    bullets([
      "**STOP**: Stop (don't send, say or do anything yet). Take a step back. Observe what is happening inside and around you. Proceed mindfully, once you can think in full sentences.",
      "**TIPP**: cold water on the face or a cold pack for about 30 seconds; or a minute of fast movement; or paced breathing (out longer than in, about 5 or 6 breaths a minute); or tense and release muscle groups. Skip the cold and the hard exercise with a heart condition, low heart rate, beta blockers or an eating disorder, and use the breathing instead.",
    ]),
  ].join("\n");
}

/** A skill, condensed for a guide. */
export function skillBrief(skill, { steps = 3 } = {}) {
  const acronym = skill.acronym?.length ? ` (${skill.acronym.map((a) => a.word).join(", ")})` : "";
  return [`### ${skill.name}${acronym}`, skill.purpose, bullets(skill.steps.slice(0, steps)), `_Full card: wise_mind_skill "${skill.id}"._`].join("\n");
}

/** A skill in full. */
export function skillCard(skill) {
  const module = MODULE_BY_ID.get(skill.module);
  const out = [`# ${skill.name}`, "", `_${module ? module.name : skill.module}, DBT. ${skill.purpose}_`, ""];
  if (skill.acronym?.length) out.push("## The letters", bullets(skill.acronym.map((a) => `**${a.letter}, ${a.word}**: ${a.meaning}`)), "");
  out.push("## When to use it", bullets(skill.whenToUse), "");
  if (skill.whenNotToUse?.length) out.push("## When not to", bullets(skill.whenNotToUse), "");
  out.push("## Steps", skill.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"), "");
  out.push("## Example", skill.example, "");
  out.push("## Pitfalls", bullets(skill.pitfalls), "");
  out.push("## Let them / let me", `- **Let them**: ${skill.letThem}`, `- **Let me**: ${skill.letMe}`, "");
  const related = skill.related.map((id) => SKILL_BY_ID.get(id)).filter(Boolean);
  if (related.length) out.push(`Related: ${related.map((r) => `${r.name} (\`${r.id}\`)`).join(", ")}.`);
  if (skill.dbtTools) out.push(`More: ${skill.dbtTools}`);
  out.push("", "Suggest practising it for real, or with someone they trust, not just reading it.", "", `_${DISCLAIMER}_`);
  return out.join("\n");
}

/** An emotion family. */
export function emotionCard(emotion, { intensity = null } = {}) {
  const out = [
    `# ${emotion.name}`,
    "",
    "Validate it first: the feeling makes sense, whatever it turns out to fit.",
    "",
    `- **Usually prompted by**: ${emotion.prompts}`,
    `- **In the body**: ${emotion.body}`,
    `- **The urge**: ${emotion.urge}`,
    "",
    "## Does it fit the facts?",
    bullets([
      "What exactly happened? Facts only, as a camera would record it.",
      "What am I telling myself it means? What else could explain it?",
      "Am I assuming a threat or a catastrophe? How likely is it, really?",
      `Does the emotion, and its size, fit? ${emotion.name} fits when ${lowerFirst(emotion.fitsWhen)}`,
    ]),
    "",
    `- **If it fits**: ${emotion.ifItFits}`,
    `- **If it doesn't fit, or acting on it would make things worse**: opposite action. ${emotion.opposite} Do it all the way (words, face, posture) and keep at it until the feeling eases.`,
    "",
    "## Let them / let me",
    `- **Let them**: ${emotion.letThem}`,
    `- **Let me**: ${emotion.letMe}`,
    "_Never a let-them if someone is hurting, threatening or controlling them, or a child in their care is at risk: safety comes first (wise_mind_crisis_support)._",
    "",
  ];
  if (intensity !== null && intensity >= 7) out.push(regulateBlock(), "");
  else {
    out.push(
      "## Riding the wave",
      "Left alone, an emotion rises, peaks and falls, often within minutes. Notice where it sits in the body, name it, don't push it away or feed it with more thoughts, and remember it is a feeling, not a fact or an order.",
      "",
    );
  }
  const skills = emotion.skills.map((id) => SKILL_BY_ID.get(id)).filter(Boolean);
  out.push(`Skills that help: ${skills.map((s) => `${s.name} (\`${s.id}\`)`).join(", ")}.`);
  return out.join("\n");
}

// ── the main guide ─────────────────────────────────────────────────────────

/** The question to end on, chosen by what is still open. */
function closingQuestion(goal, situation) {
  if (situation?.notLetThem) return "Are you safe right now, and is there someone you trust who knows what's going on?";
  if (!goal) return "What would help most right now: being heard, calming down, making sense of it, or working out what to do?";
  if (goal === "talk_to_them" || goal === "set_a_boundary") {
    return "What matters most here: getting what you want, keeping the relationship, or keeping your self-respect? (That decides which script leads.)";
  }
  if (goal === "let_it_go") return "What part of this keeps pulling you back: something they did, or something you wish you'd done?";
  return "What is one small thing you could do in the next day that you'd feel good about?";
}

const FOOTER = `_${ATTRIBUTION} ${DISCLAIMER} For distress that keeps coming back, a GP or a DBT-trained therapist is the right next step; if they seem to be under 18, a trusted adult and youth services._`;

export function situationGuide({ situationType = "", topic = "", emotions: emotionWords = [], intensity = null, goal = null, relationship = null, safety = "none", country = null }) {
  const matched = forRelationship(situationById(situationType) || matchSituations(topic)[0]?.situation || null, relationship);
  const level = worst(worst(safety, screen(topic)), safetyOf(matched));
  if (replacesGuide(level)) return crisisGuide(level, country, { abuse: abuseAlongside(safety, topic, matched) });

  const emotions = [...new Map([...emotionWords.map(findEmotion), ...emotionsIn(topic)].filter(Boolean).map((e) => [e.id, e])).values()].slice(0, 2);
  const dependant = relationship === "child_in_my_care" || matched?.id === "teenager-risky-choices";
  const skills = pickSkills({ situation: matched, goal, emotions, intensity });

  const out = [`# Wise Mind guide${matched ? `: ${matched.title.toLowerCase()}` : ""}`, ""];
  if (level === "hopeless_or_burden") out.push(checkInBlock(country), "");
  out.push(
    "## How to use this",
    bullets([
      "This is for you, the assistant. Reply in your own warm words; don't paste it.",
      "Validate first: reflect what happened and what they feel, and why it makes sense. If they mainly want to vent, listen, and offer the rest only if they want it.",
      "Don't take sides on a one-sided account or label anyone; describe behaviour, not diagnoses.",
      "Then one or two skills, not a menu, one small step, and a question. Point them towards people in their life where it fits.",
    ]),
    "",
  );
  if (intensity !== null && intensity >= 7) out.push(regulateBlock(), "");

  if (emotions.length) {
    out.push("## What they may be feeling");
    for (const e of emotions) out.push(`- **${e.name}**`, `  - Urge: ${e.urge}`, `  - Fits the facts when: ${e.fitsWhen}`, `  - If it fits: ${e.ifItFits}`, `  - If not: ${e.opposite}`);
    out.push("");
  }

  if (matched?.notLetThem || dependant) {
    out.push("## Careful: not a straight let-them situation", matched?.notLetThem || EXCEPTIONS.find((x) => x.name === "Dependants").text, "");
  }
  // Said before the sort, so the exception is read before the acceptance it limits.
  if (matched?.caution) out.push(`**Careful**: ${matched.caution}`, "");

  out.push(
    "## Sort it: theirs, mine, shared",
    `- **Let them** (theirs): ${matched ? matched.letThem : "what the other person does, thinks and feels, their decisions and their pace of change."}`,
    `- **Let me** (mine): ${matched ? matched.letMe : "my reaction, my words, my limits and requests, my time, and my next step."}`,
    "- **Shared**: anything that lands on both people (money, a home, children, a team deliverable) needs asking and negotiating, not just acceptance.",
    "",
  );
  if (skills.length) out.push("## Skills that fit", ...skills.map((s) => skillBrief(s)), "");
  if (matched?.firstStep) out.push("## One small step", matched.firstStep, "");
  out.push(
    "## Before suggesting they let it go",
    "Check none of these apply; if one does, it moves to Let Me or Shared: abuse or danger, someone at risk, a dependant's safety, a workplace issue to escalate, a shared problem, or criticism that holds facts worth acting on.",
    "",
    `Ask them: ${closingQuestion(goal, matched)}`,
    "",
    "---",
    FOOTER,
  );
  return out.join("\n");
}

// ── the Let Them / Let Me lens ─────────────────────────────────────────────

export function letThemGuide({ situationType = "", relationship = null, safety = "none", country = null }) {
  const matched = forRelationship(situationById(situationType), relationship);
  const level = worst(safety, safetyOf(matched));
  if (replacesGuide(level)) return crisisGuide(level, country, { abuse: abuseAlongside(safety, "", matched) });

  const names = (ids) => ids.map((id) => SKILL_BY_ID.get(id)?.name).filter(Boolean).join(", ");
  const side = (s) => MAPPINGS.filter((m) => m.side === s);
  const out = ["# Let them, let me", ""];
  if (safety === "hopeless_or_burden") out.push(checkInBlock(country), "");
  out.push(
    LET_THEM.summary,
    "",
    "## How to use this",
    bullets([
      "Validate the feeling first; sorting comes second.",
      "Help them sort each worry into three: theirs (let them), mine (let me), shared (ask and negotiate).",
      "Always finish on Let Me: one concrete action. Let Them on its own slides into withdrawal.",
    ]),
    "",
  );
  // Said before the playbook, so the exception is read before the acceptance it limits.
  const dependant = relationship === "child_in_my_care" || matched?.id === "teenager-risky-choices";
  if (matched?.notLetThem || dependant) out.push(`**Careful**: ${matched?.notLetThem || EXCEPTIONS.find((x) => x.name === "Dependants").text}`, "");
  if (matched?.caution) out.push(`**Careful**: ${matched.caution}`, "");
  if (matched) {
    out.push(`## This looks like: ${matched.title.toLowerCase()}`, `- **Let them**: ${matched.letThem}`, `- **Let me**: ${matched.letMe}`, `- **First step**: ${matched.firstStep}`, "");
  }
  out.push(
    "## Sorting tests",
    bullets([
      "Another adult decides, thinks or feels it: **theirs**.",
      "It is my action, words, limit, request or time: **mine**.",
      "Their choice lands directly on me, or we share it (money, home, children, work): **shared**, so ask and negotiate.",
      "Danger, a dependant's safety, or something to escalate: **never theirs**.",
    ]),
    "",
    "## What to let them do, and the skill behind it",
    bullets(side("them").map((m) => `${m.what}: ${names(m.skills)}. ${m.why}`)),
    "",
    "## What to let me do, and the skill behind it",
    bullets(side("me").map((m) => `${m.what}: ${names(m.skills)}.`)),
    "",
    "## When it's both",
    bullets(side("both").map((m) => `${m.what}: ${names(m.skills)}. ${m.why}`)),
    "",
    "## Never 'let them'",
    bullets(EXCEPTIONS.map((x) => `**${x.name}**: ${x.text}`)),
    "",
    'A sentence to finish on together: "Let them ___ (their choice). Let me ___ (my next step, today)."',
    "",
    "---",
    `_${ATTRIBUTION} ${DISCLAIMER}_`,
  );
  return out.join("\n");
}

// ── conversations ──────────────────────────────────────────────────────────

const KIND_TITLE = { ask: "Ask for something", say_no: "Say no", set_a_boundary: "Set a boundary", raise_a_problem: "Raise a problem", repair: "Repair after a falling out" };

const ASSERT = {
  ask: '"I\'d like ___." One sentence, no hinting, no "you should".',
  say_no: '"No, I\'m not able to ___." Short, no pile of excuses. A reason is optional; a true one, once.',
  set_a_boundary: '"If ___ happens again, I will ___." Name what YOU will do. A boundary is your action, not an order to them.',
  raise_a_problem: '"I\'d like us to ___ from now on." Ask for the specific change, not for them to be a different person.',
  repair: '"I\'m sorry for ___ (my part, specifically). I\'d like ___." Apologise once, for your share only.',
};

const REACTION_PLAN = {
  agree: "They agree: thank them specifically, and later notice and thank them again when they follow through.",
  push_back: 'They push back: don\'t argue each point. Repeat the one line ("I hear you, and I\'d still like ___"), then negotiate if it helps.',
  get_angry: "They get angry: lower your voice, validate the feeling (\"I can see this annoys you\"), and say you'll pick it up later if it escalates. Leave if it turns abusive.",
  guilt_trip: 'They guilt-trip: name it kindly and hold the line ("I know you\'re disappointed. My answer is still no."). Their disappointment is theirs to have.',
  go_quiet: "They go quiet or sulk: let the silence sit; don't fill it with more explaining or a retraction. Check in once, later.",
  unsure: "Picture the likely reaction, and the worst realistic one, and plan one calm line for each.",
};

export function conversationGuide({ kind = "ask", relationship = null, priority = null, channel = null, reaction = null, safety = "none", country = null }) {
  if (replacesGuide(safety)) return crisisGuide(safety, country, { abuse: safety === "abuse_or_unsafe" });
  if (safety === "hopeless_or_burden") return withCheckIn(conversationGuide({ kind, relationship, priority, channel, reaction, country }), country);

  const lead =
    priority === "relationship" ? "**GIVE leads**: keep the relationship warm while you ask." :
    priority === "self_respect" ? "**FAST leads**: protect your self-respect, whatever their answer." :
    priority === "objective" ? "**DEAR MAN leads**: the outcome matters most here." :
    "Decide first what matters most here: the outcome (DEAR MAN leads), the relationship (GIVE leads) or self-respect (FAST leads). All three still apply.";
  const who = withWhom(relationship);
  const reactions = reaction && reaction !== "unsure" ? [REACTION_PLAN[reaction], REACTION_PLAN.unsure] : [REACTION_PLAN.unsure, REACTION_PLAN.push_back];

  const out = [
    `# ${KIND_TITLE[kind] || KIND_TITLE.ask}: a conversation plan${who}`,
    "",
    "## How to use this",
    bullets([
      "Fill the blanks WITH them, in their words and their voice. Keep the script to four or five sentences.",
      lead,
      relationship === "manager" || relationship === "client" ? "With someone who has power over them, keep it factual and specific, and write it down afterwards." : "Pick a calm, private moment, not the middle of an argument.",
    ]),
    "",
    "## DEAR MAN: the script",
    bullets([
      "**Describe**: the facts, in one or two sentences a video camera would agree with. No 'always', no guesses about their motives.",
      "**Express**: one 'I feel ___' or 'I think ___' sentence. Skip it with strangers, or where it would only inflame things.",
      `**Assert**: ${ASSERT[kind] || ASSERT.ask}`,
      "**Reinforce**: one line on what gets better for them, or for both of you, if they agree.",
      '**Mindful**: one short line to repeat if they deflect ("I hear you, and I\'d still like ___"). Don\'t chase side topics.',
      "**Appear confident**: steady voice, upright, eye contact, even if nervous inside.",
      "**Negotiate**: one or two compromises they'd accept, decided beforehand, or ask them: 'How would you solve this?'",
    ]),
    "",
    "## GIVE: keep the relationship",
    "Gentle (no attacks, threats or judging), Interested (listen to their side without interrupting), Validate (\"I can see this is a lot to ask\"), Easy manner (a little warmth or lightness).",
    "",
    "## FAST: keep your self-respect",
    "Fair (to them and to you), no over-Apologising, Stick to your values, Truthful (no excuses you don't mean).",
    "",
  ];
  if (channel === "message") {
    out.push(
      "## In writing",
      bullets([
        "Draft it, then wait an hour (or sleep on it) before sending, and read it back as they would.",
        "Cut anything sarcastic, any list of past grievances, and any line written to win.",
        "Send it once. Don't follow up with more messages while waiting for a reply.",
      ]),
      "",
    );
  }
  out.push(
    "## Cope ahead",
    bullets([...reactions, "Rehearse it once out loud. Afterwards, whatever happened, give yourself credit for saying it."]),
    "",
    "## Let them / let me",
    "- **Let them** answer how they answer: yes, no, sulking or arguing. Their response is information, not a ruling on whether you were allowed to ask.",
    "- **Let me** own the ask, the tone, the repeat, and my plan if it's a no: accept it, negotiate, take another route, or change what I do.",
    "",
    "_Not for someone who is hurting, threatening or controlling them: then safety planning comes first, not a script (wise_mind_crisis_support)._",
    "",
    "---",
    `_DEAR MAN, GIVE and FAST are DBT interpersonal effectiveness skills. ${DISCLAIMER}_`,
  );
  return out.join("\n");
}

// ── search and inventory ───────────────────────────────────────────────────

const STOP_WORDS = new Set("a an and are as at be but by do for from how i if in is it me my of on or so that the their them they this to was we what when with you your".split(" "));
const tokens = (text) => norm(text).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));

/** Rank skills, situations and emotions against a few words. Deterministic and cheap. */
export function search(query, { limit = 6 } = {}) {
  const q = norm(query);
  const qt = new Set(tokens(q));
  const scoreText = (text, weight) => tokens(text).reduce((n, t) => n + (qt.has(t) ? weight : 0), 0);
  const exact = findSkill(q);
  const skills = SKILLS.map((s) => {
    let score = s === exact ? 50 : 0;
    score += scoreText(s.name, 4) + s.aliases.reduce((n, a) => n + (q.includes(norm(a)) ? 6 : scoreText(a, 2)), 0);
    score += s.keywords.reduce((n, k) => n + (q.includes(norm(k)) ? 5 : 0), 0);
    score += scoreText(s.purpose, 1) + scoreText(s.whenToUse.join(" "), 1) * 0.5;
    return { skill: s, score };
  })
    .filter((r) => r.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { skills, situations: matchSituations(q).slice(0, 2).map((r) => r.situation), emotions: emotionsIn(q).slice(0, 2) };
}

export function searchResults(query, limit = 6) {
  const { skills, situations, emotions } = search(query, { limit });
  const out = [`# Skills for "${query}"`, ""];
  if (situations.length) out.push("## Situation playbooks", ...situations.map((s) => `- \`${s.id}\` **${s.title}**: ${s.summary} (wise_mind_work_through_situation, situation_type "${s.id}")`), "");
  if (emotions.length) out.push("## Emotion cards", ...emotions.map((e) => `- **${e.name}** (wise_mind_understand_emotion "${e.id}")`), "");
  if (skills.length) out.push("## Skills", ...skills.map(({ skill }) => `- \`${skill.id}\` **${skill.name}** (${MODULE_BY_ID.get(skill.module)?.name}): ${skill.purpose}`));
  if (!skills.length && !situations.length && !emotions.length) {
    out.push("Nothing matched. Try plainer words ('angry', 'say no', 'can't sleep'), or call wise_mind_skill with no arguments for the full list.");
  }
  return out.join("\n");
}

export function inventory(moduleId = "") {
  const wanted = oneOf(moduleId, MODULES.map((m) => m.id));
  const modules = MODULES.filter((m) => !wanted || m.id === wanted);
  const out = ["# Wise Mind: what is here", ""];
  if (!wanted) {
    out.push("## Let Them / Let Me", `${LET_THEM.summary} Tools: wise_mind_theirs_or_mine and wise_mind_work_through_situation.`, "");
  }
  for (const m of modules) {
    const skills = SKILLS.filter((s) => s.module === m.id);
    out.push(`## ${m.name} (${skills.length})`, m.summary, "", bullets(skills.map((s) => `\`${s.id}\` **${s.name}**: ${s.purpose}`)), "");
  }
  if (!wanted) {
    out.push(
      "## Situation playbooks",
      SITUATIONS.map((s) => `\`${s.id}\``).join(", "),
      "",
      "## Emotion cards",
      EMOTIONS.map((e) => e.name).join(", "),
      "",
    );
  }
  return out.join("\n");
}
