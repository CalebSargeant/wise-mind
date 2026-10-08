/**
 * Who this server is: the constants every surface (the protocol answers, the
 * Server Card, the page at /) is built from, so they cannot disagree.
 *
 * `instructions` is the most important text in the repository. Clients that
 * support it put it in the model's context when the server connects, and it is
 * what makes an assistant reach for these tools when a person describes a hard
 * moment without asking for "DBT" by name. The order follows the MCP project's
 * guidance on server instructions: what it is, when to use it, the workflow, the
 * safety route, what it is not. No "always" or "must": instructions are a hint
 * a client may drop, never the only safeguard, which is why every tool description
 * repeats its own triggers. tests/tools.test.mjs holds this under 1,500 characters
 * (Claude Code cuts at 2,048) and checks it names every tool.
 */

export const ENDPOINT = "https://wisemind.calebsargeant.com/";
export const REPOSITORY = "https://github.com/CalebSargeant/wise-mind";

export const INSTRUCTIONS = [
  // 1. What it is, and 2. when: the trigger sits in the first few hundred characters.
  "Wise Mind: practical and emotional help for hard moments with other people, from DBT (dialectical behaviour therapy) skills and the Let Them / Let Me approach (accept what other adults choose, think and feel; act on what is yours).",
  "Use it when the user describes something painful or stuck in their own life, even without asking for techniques: tension or conflict with a partner, relative, friend or boss; feeling hurt, rejected, left out, criticised or compared; anxiety, overthinking or replaying a conversation; anger, guilt, shame, jealousy or overwhelm; a boundary to set or a hard conversation ahead. Not for passing gripes, fiction or writing tasks.",
  // 3. The workflow, and privacy where the model builds arguments.
  "Start with wise_mind_work_through_situation, passing categories only, never names or story details, unless a more specific tool fits: wise_mind_plan_conversation for wording a hard message, wise_mind_understand_emotion for one feeling, wise_mind_skill for a named skill, wise_mind_theirs_or_mine for what to let go of. Acknowledge the feeling first, then one or two concrete steps in your own words; if they mostly want to vent, the guide says how to listen first.",
  // 4. Safety routing.
  "If suicide, self-harm, abuse, feeling unsafe or someone else at risk comes up, call wise_mind_crisis_support straight away and put safety ahead of skills; for hopelessness or feeling like a burden, set safety on the main tool.",
  // 5. What it is not.
  "Self-help education, not therapy, diagnosis or medication advice. Nothing is stored. Not affiliated with Mel Robbins or Marsha Linehan.",
].join(" ");

export const SERVER = {
  name: "wise-mind",
  title: "Wise Mind",
  version: "1.0.0",
  websiteUrl: ENDPOINT,
  icons: [
    { src: `${ENDPOINT}icon.png`, mimeType: "image/png", sizes: ["180x180"] },
    { src: `${ENDPOINT}icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
  ],
  instructions: INSTRUCTIONS,
};
