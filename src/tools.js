/**
 * The tools: six read-only verbs over the bundled content.
 *
 * ── WRITTEN FOR THE MODEL THAT DECIDES WHEN TO USE THEM ─────────────────────
 *
 * The point of this server is that an assistant reaches for it on its own when a
 * person describes a hard moment, without being asked to "use DBT". That decision
 * is made from the server instructions (server.js), these names and these
 * descriptions, and the instructions are not delivered by every client, so each
 * description carries its own triggers in the words people actually use. Each
 * says what it returns, then "Use when", in that order, and none orders the model
 * around ("always call", "call first"), which connector review rejects.
 *
 * Names carry a `wise_mind_` prefix because a synced connector reaches the model
 * as `mcp__<uuid>__<name>`: the server's name is not in front of the tool, so the
 * tool has to say whose it is.
 *
 * ── CATEGORIES IN, NOT STORIES ──────────────────────────────────────────────
 *
 * Arguments are enums and numbers wherever possible. A client shows the arguments
 * on its permission card, so they should read as gentle labels rather than a
 * retelling of someone's worst week, and a story that never leaves the
 * conversation cannot be leaked from here. The free text is limited to `topic`
 * (120 characters, for situations no playbook covers), `skill` (120), `emotion`
 * (60) and `country` (60). The first three go through the same safety screen as
 * everything else.
 *
 * ── `_meta["anthropic/alwaysLoad"]` ─────────────────────────────────────────
 *
 * Claude Code defers MCP tool definitions until a search finds them. The front
 * door and the crisis tool are exempt, so the first emotional message of a
 * session does not depend on a search matching; the other four stay deferred and
 * are found by their names and descriptions.
 */

import {
  CHANNELS,
  CONVERSATION_KINDS,
  EMOTION_IDS,
  GOALS,
  PRIORITIES,
  REACTIONS,
  RELATIONSHIPS,
  SAFETY,
  SKILL_BY_ID,
  checkInBlock,
  conversationGuide,
  crisisGuide,
  emotionGuide,
  mentionsAbuse,
  replacesGuide,
  screen,
  findCountry,
  findSkill,
  int,
  inventory,
  letThemGuide,
  list,
  oneOf,
  safetyLevel,
  searchResults,
  situationGuide,
  skillCard,
  str,
} from "./guide.js";
import { EMOTIONS } from "./content/emotions.js";
import { SITUATION_IDS } from "./content/situations.js";
import { COUNTRIES } from "./content/crisis.js";
import { MODULES, SKILLS } from "./content/skills.js";

/** How much text one tool call may return. The guides sit well under it. */
const MAX_REPLY_CHARS = 24_000;
const clip = (text) => (text.length <= MAX_REPLY_CHARS ? text : `${text.slice(0, MAX_REPLY_CHARS).trimEnd()}\n\n[truncated]`);

const ALWAYS_LOAD = { "anthropic/alwaysLoad": true };

const PRIVATE = " Choose the closest; no names or details are needed.";

const COUNTRY = {
  type: "string",
  maxLength: 60,
  description:
    "Only if the user has said which country they're in (ISO code like NL, ZA, GB, US, or a name). Never guess it from spelling or language. " +
    "Used only to show the right local crisis lines; omit it otherwise.",
};

const SAFETY_FIELD = {
  type: "string",
  enum: SAFETY,
  description:
    "Any sign of risk in what they've said. hopeless_or_burden: hopelessness, 'what's the point', feeling like a burden (adds a gentle safety check-in to the guide). " +
    "suicide_or_self_harm: any mention of wanting to die, suicide or self-harm. abuse_or_unsafe: being hurt, threatened, controlled or afraid of someone. " +
    "someone_else_at_risk: worry that another person may harm themselves or take their life. The last three return safety guidance and local help instead of skills. Default none.",
};

const RELATIONSHIP = {
  type: "string",
  enum: RELATIONSHIPS,
  description: "Who the other person is to them, if clear; leave it out rather than guess." + PRIVATE + " child_in_my_care matters: a dependant's safety is never a let-them matter.",
};

const SITUATION_TYPE = {
  type: "string",
  enum: [...SITUATION_IDS, "other"],
  description: "The closest situation playbook, or other." + PRIVATE,
};

export const TOOLS = [
  {
    name: "wise_mind_work_through_situation",
    title: "Work through a hard moment",
    description:
      "Returns a short guide for helping someone through a hard moment with another person or a strong feeling: how to validate them, how to bring the intensity down if they're flooded, " +
      "what to let the other person own (Let Them) and what is the user's own to do (Let Me), the two or three DBT skills that fit, one small next step and a question to ask. " +
      "Use when the user describes something painful in their own life, even if they never mention DBT or ask for techniques: conflict, criticism, feeling hurt, rejected, left out, ghosted or ignored, " +
      "anger, anxiety about what people think, guilt, shame, jealousy, comparing themselves, people-pleasing, a boundary to set, a conversation they dread, someone who won't change, a breakup, grief, " +
      "family pressure, comments about their body, replaying things at night, or overwhelm. If they're venting about something that's really bothering them, call it anyway: its guidance starts with listening, not skills. " +
      "Takes categories, not their story. Shape your own warm reply from it rather than pasting it. " +
      "If a more specific tool clearly fits, use that instead: wording a message or a hard conversation (wise_mind_plan_conversation), one named feeling (wise_mind_understand_emotion), a named skill (wise_mind_skill). " +
      "If anything suggests suicide, self-harm, abuse or danger, set safety and it returns safety guidance and local help instead. " +
      "Not for casual mentions, fiction, writing tasks, diagnosis, medication, or general questions about DBT.",
    inputSchema: {
      type: "object",
      properties: {
        situation_type: SITUATION_TYPE,
        topic: {
          type: "string",
          maxLength: 120,
          description: "Only when situation_type is other: the situation in a few words, for example 'tension with a neighbour'. No names, places or story details.",
        },
        emotions: {
          type: "array",
          items: { type: "string", enum: EMOTION_IDS },
          maxItems: 3,
          description:
            "The closest emotion families, only if they've said or shown how they feel (omit otherwise): anxious or worried is fear, hurt or lonely is sadness, embarrassed is shame, " +
            "frustrated is anger, jealous of someone's success is envy (jealousy is fear of losing someone). Exhausted or overwhelmed: pick what's underneath, or omit.",
        },
        intensity: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          description: "How strong it is right now, 0 to 10: a number they gave, or 8 if their words say they can't think straight. Otherwise omit. 7 or more puts calming the body first.",
        },
        goal: { type: "string", enum: GOALS, description: "What they want from this, if known." },
        relationship: RELATIONSHIP,
        safety: SAFETY_FIELD,
        country: COUNTRY,
      },
      required: ["situation_type"],
      additionalProperties: false,
    },
    _meta: ALWAYS_LOAD,
    handler: async (args) =>
      clip(
        situationGuide({
          situationType: str(args.situation_type, 60),
          topic: str(args.topic, 120),
          emotions: list(args.emotions, 3),
          intensity: int(args.intensity, 0, 10),
          goal: oneOf(args.goal, GOALS),
          relationship: oneOf(args.relationship, RELATIONSHIPS),
          safety: safetyLevel(args.safety),
          country: findCountry(str(args.country, 60)),
        }),
      ),
  },
  {
    name: "wise_mind_crisis_support",
    title: "Crisis support and local helplines",
    description:
      `Returns how to respond safely in a crisis moment, and the local crisis lines, domestic abuse services and emergency numbers for the user's country (${COUNTRIES.length} countries, plus directories for everywhere else). ` +
      "Use when the user mentions suicide, wanting to die, self-harm, feeling unsafe, abuse, threats or violence, or that someone else may harm themselves, and put it ahead of any skills. " +
      "Call it straight away, without waiting to learn their country: without one it returns directories and asks where they are. " +
      "It adds local numbers to your own crisis handling and connects them with real people; it never replaces either.",
    inputSchema: {
      type: "object",
      properties: {
        country: COUNTRY,
        concern: {
          type: "string",
          enum: ["suicide_or_self_harm", "abuse_or_unsafe", "someone_else_at_risk"],
          description: "What the concern is. If unclear, omit it: the answer then covers suicide and self-harm and also lists domestic abuse services.",
        },
      },
      additionalProperties: false,
    },
    _meta: ALWAYS_LOAD,
    handler: async (args) => {
      const concern = oneOf(args.concern, SAFETY.slice(1));
      // Hopelessness alone still gets the full crisis answer here: whoever called
      // the crisis tool already thought it was that serious.
      const country = findCountry(str(args.country, 60));
      if (!concern) return crisisGuide("suicide_or_self_harm", country, { abuse: true });
      return crisisGuide(concern === "hopeless_or_burden" ? "suicide_or_self_harm" : concern, country);
    },
  },
  {
    name: "wise_mind_theirs_or_mine",
    title: "Theirs or mine: sort what to accept from what to act on (Let Them / Let Me)",
    description:
      "Returns the Let Them / Let Me framework bridged to DBT: what to accept about other people (and the acceptance skills behind it), what to own yourself (and the change skills), " +
      "what is shared and needs negotiating, sorting tests, and the cases where 'let them' never applies (abuse, danger, dependants, things to escalate). " +
      "Use when the user is stuck on what someone else is doing, thinking or feeling: trying to control, fix, change, convince or please another adult, worrying what people think, " +
      "carrying someone else's mood, or asking about the Let Them theory.",
    inputSchema: {
      type: "object",
      properties: {
        situation_type: SITUATION_TYPE,
        relationship: RELATIONSHIP,
        safety: SAFETY_FIELD,
        country: COUNTRY,
      },
      additionalProperties: false,
    },
    handler: async (args) =>
      clip(
        letThemGuide({
          situationType: str(args.situation_type, 60),
          relationship: oneOf(args.relationship, RELATIONSHIPS),
          safety: safetyLevel(args.safety),
          country: findCountry(str(args.country, 60)),
        }),
      ),
  },
  {
    name: "wise_mind_plan_conversation",
    title: "Plan a hard conversation (DEAR MAN, GIVE, FAST)",
    description:
      "Returns a DBT script scaffold for a hard message or conversation, which you turn into the full draft: DEAR MAN for the ask, GIVE to protect the relationship, FAST to protect self-respect, " +
      "a plan for how they're likely to react, tips for writing it as a message, and the Let Them / Let Me stance on the answer. " +
      "Use when the user needs to ask for something, say no, set a boundary, raise a recurring problem or repair things with someone, and it carries emotional weight or tension, " +
      "or asks how to word a text, message or email to someone they're in tension with. Write the whole draft from what the conversation already holds (a pasted message, what happened, what they want), in their voice, and ask only for what is missing. " +
      "Not for routine work messages, and not for confronting someone who is hurting or threatening them.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: CONVERSATION_KINDS, description: "What the conversation is for." },
        relationship: RELATIONSHIP,
        priority: { type: "string", enum: PRIORITIES, description: "What matters most: the outcome (objective), the relationship, or their self-respect. Omit if unclear; the plan says how to decide." },
        channel: { type: "string", enum: CHANNELS, description: "In person, a written message, or a call." },
        likely_reaction: { type: "string", enum: REACTIONS, description: "How the other person is likely to react, if they said." },
        safety: SAFETY_FIELD,
        country: COUNTRY,
      },
      required: ["kind"],
      additionalProperties: false,
    },
    handler: async (args) =>
      clip(
        conversationGuide({
          kind: oneOf(args.kind, CONVERSATION_KINDS) || "ask",
          relationship: oneOf(args.relationship, RELATIONSHIPS),
          priority: oneOf(args.priority, PRIORITIES),
          channel: oneOf(args.channel, CHANNELS),
          reaction: oneOf(args.likely_reaction, REACTIONS),
          safety: safetyLevel(args.safety),
          country: findCountry(str(args.country, 60)),
        }),
      ),
  },
  {
    name: "wise_mind_understand_emotion",
    title: "Understand an emotion: does it fit, and what to do",
    description:
      "Returns DBT's card for one emotion family: what usually prompts it, the body signs, the urge, when it fits the facts, what to do if it fits (problem-solve) and if it doesn't (opposite action), " +
      "how to ride the wave, and the Let Them / Let Me angle. " +
      "Use when the user names or shows a strong feeling and wants to understand it or stop being run by it: anxiety, anger, hurt, sadness, shame, guilt, jealousy, envy, longing for an ex, disgust. " +
      "Takes everyday words ('gutted', 'on edge', 'mortified').",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string", maxLength: 60, description: "The feeling, in their word or as a family: fear, anger, sadness, shame, guilt, jealousy, envy, love, disgust, joy." },
        intensity: { type: "integer", minimum: 0, maximum: 10, description: "How strong, 0 to 10, if known. 7 or more adds calming the body first." },
        safety: SAFETY_FIELD,
        country: COUNTRY,
      },
      required: ["emotion"],
      additionalProperties: false,
    },
    handler: async (args) =>
      clip(
        emotionGuide({
          word: str(args.emotion, 60),
          intensity: int(args.intensity, 0, 10),
          safety: safetyLevel(args.safety),
          country: findCountry(str(args.country, 60)),
        }),
      ),
  },
  {
    name: "wise_mind_skill",
    title: "DBT skills: one in full, a search, or the whole list",
    description:
      `Returns DBT skill content. With a skill name (DEAR MAN, TIPP, STOP, ACCEPTS, IMPROVE, wise mind, radical acceptance, opposite action, check the facts, GIVE, FAST, validation, cope ahead and others; ${SKILLS.length} in all), ` +
      "the full card: the letters, when to use it and when not, steps, an example, pitfalls and its Let Them / Let Me angle. With a few words about a problem ('calm my body', 'say no'), a ranked shortlist. " +
      "With nothing, the full list by module. Use when the user wants to learn or practise a skill, asks which skill fits, or wants to go deeper on one another tool suggested.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          maxLength: 120,
          description: "A skill's name, acronym or id ('DEAR MAN', 'tipp', 'radical acceptance'), or a few general words about the problem ('say no', 'calm my body'), never personal details. Omit for the full list.",
        },
        module: { type: "string", enum: MODULES.map((m) => m.id), description: "With no skill: list only this module." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const query = str(args.skill, 120);
      if (!query) return clip(inventory(str(args.module, 60)));
      // Screened before any lookup, so risk wording never gets a skills shortlist.
      const level = screen(query);
      if (replacesGuide(level)) return crisisGuide(level, null, { abuse: mentionsAbuse(query) });
      const skill = findSkill(query);
      const body = skill ? skillCard(skill) : searchResults(query);
      return clip(level === "hopeless_or_burden" ? `${checkInBlock(null)}\n\n${body}` : body);
    },
  },
];

// Fail at module load, not at call time, if content points at a skill that doesn't exist.
for (const id of new Set([...EMOTIONS.flatMap((e) => e.skills), ...SKILLS.flatMap((s) => s.related)])) {
  if (!SKILL_BY_ID.has(id)) throw new Error(`content refers to unknown skill: ${id}`);
}
