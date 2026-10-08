/**
 * Prompts: the slash commands a person can start themselves.
 *
 * Tools are the model's to call; prompts are the user's (Claude Code shows them
 * as `/mcp__wise-mind__<name>`, the Claude apps in the attachment menu). Each one
 * renders a single user message that asks the assistant to hold the conversation
 * a certain way and which tool to use, so a person who knows what they want does
 * not have to wait for the model to notice.
 *
 * ── NO ARGUMENTS, ON PURPOSE ────────────────────────────────────────────────
 *
 * A prompt argument is free text sent to this server, and the only thing a prompt
 * could do with "what happened" is echo it back: the person's story would leave
 * their conversation for nothing. Claude Code also splits typed text on spaces
 * and hands each argument one word, which would turn "my sister forgot my
 * birthday" into "my". So the prompts take nothing; whatever the person typed
 * after the command stays in their conversation, and the assistant asks for
 * anything it still needs.
 */

const message = (text) => ({ role: "user", content: { type: "text", text } });

const TYPED = "If I typed something after the command, that's what I mean; otherwise ask me.";

export const PROMPTS = [
  {
    name: "hard_moment",
    title: "I'm having a hard moment",
    description: "Start here when something has upset you. The assistant listens first, helps you settle if it's all too much, then works through it with you using DBT skills and Let Them / Let Me.",
    arguments: [],
    render: () => ({
      description: "Work through a hard moment",
      messages: [
        message(
          `I'm having a hard moment and I'd like some help with it. ${TYPED}\n\n` +
            "Please listen first and reflect back what you hear before suggesting anything. If you don't know yet, ask me what happened and how strong it feels from 0 to 10. " +
            "Then use the wise_mind_work_through_situation tool to guide your reply, sending categories rather than my story. " +
            "If I mention wanting to die, self-harm or not being safe, use wise_mind_crisis_support first.",
        ),
      ],
    }),
  },
  {
    name: "theirs_or_mine",
    title: "Theirs or mine? (Let Them / Let Me)",
    description: "Sort what belongs to the other person from what's yours to do, with the DBT skills for each side and the cases where letting go doesn't apply.",
    arguments: [],
    render: () => ({
      description: "Theirs or mine",
      messages: [
        message(
          `Help me sort out what's mine to deal with here and what isn't, using Let Them / Let Me. ${TYPED} No names needed.\n\n` +
            "Use the wise_mind_theirs_or_mine tool. Help me sort what's theirs, what's mine and what's shared, and finish with one concrete thing I'll do. " +
            "If it involves danger, abuse or someone in my care, tell me plainly that letting go doesn't apply, and if I mention wanting to die, self-harm or not being safe, use wise_mind_crisis_support first.",
        ),
      ],
    }),
  },
  {
    name: "prepare_conversation",
    title: "Prepare a hard conversation",
    description: "Plan what to say when you need to ask for something, say no, set a boundary or repair things, using DBT's DEAR MAN, GIVE and FAST.",
    arguments: [],
    render: () => ({
      description: "Prepare a hard conversation",
      messages: [
        message(
          `I need to have a hard conversation and want to prepare. ${TYPED}\n\n` +
            "Ask me who it's with, what I want from it and what matters most (the outcome, the relationship or my self-respect) if I haven't said. " +
            "Then use the wise_mind_plan_conversation tool and write the draft for me from what I've told you, in my voice. Keep it short.",
        ),
      ],
    }),
  },
  {
    name: "check_in",
    title: "Daily check-in",
    description: "A two-minute check-in: how you feel, how strong, what you did with it, and one skill to practise today.",
    arguments: [],
    render: () => ({
      description: "Daily check-in",
      messages: [
        message(
          "Let's do a short check-in. Ask me one question at a time: what I'm feeling right now and how strong (0 to 10); " +
            "anything that's been on my mind with someone; whether I had urges I acted on or held back from; and how I've slept, eaten and moved. " +
            "Then pick one DBT skill that fits (use the wise_mind_skill tool) and suggest one small way to practise it today. " +
            "If I mention urges to hurt myself, wanting to die or not being safe, use wise_mind_crisis_support first instead of a skill. Keep it brief and kind.",
        ),
      ],
    }),
  },
];
