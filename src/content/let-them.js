/**
 * The Let Them / Let Me idea, and how it sits on top of DBT.
 *
 * The idea was popularised by The Let Them Theory (Mel Robbins with Sawyer Robbins,
 * Hay House, 2024) and has older roots. Everything here is a summary in this
 * project's own words, and nothing in this repository is affiliated with or
 * endorsed by her. The phrase stays out of every name (repository, hostname,
 * tools, prompts) because Mel Robbins Productions has applied to register it. ATTRIBUTION is said on every answer that
 * leans on it, because a person should know where an idea came from.
 *
 * The bridge to DBT is the point of the whole server: DBT's central dialectic is
 * acceptance AND change, and Let Them / Let Me cuts that same tension along one
 * line, other people versus yourself. Let Them is the acceptance pole aimed at
 * what others do, think and feel; Let Me is the change pole aimed at your own next
 * move. The slogan is easy to remember under stress and thin on method, and DBT
 * supplies the method.
 */

export const ATTRIBUTION =
  "Let Them / Let Me was popularised by The Let Them Theory (Mel Robbins with Sawyer Robbins, Hay House, 2024) and has older roots " +
  "(the Stoic dichotomy of control, the Serenity Prayer, radical acceptance); it is summarised here in our own words, and this project is " +
  "not affiliated with, endorsed by or sponsored by Mel Robbins, Mel Robbins Productions or Hay House. " +
  "The skills are from Marsha Linehan's Dialectical Behaviour Therapy (DBT).";

/** The trademark position, said wherever the phrase is used as more than a passing reference. */
export const TRADEMARK =
  "Mel Robbins Productions, Inc. has applied to register LET THEM and LET THEM THEORY as trademarks; the phrases are used here only to describe an idea this project draws on.";

export const DISCLAIMER =
  "Self-help education, not therapy, diagnosis or a crisis service. DBT proper is a structured treatment delivered by trained clinicians.";

export const LET_THEM = {
  summary:
    "A two-step tool for moments involving other adults. Let Them: stop spending energy steering what you cannot " +
    "control, which is other adults' choices, opinions, moods and reactions. Let Me: put that energy back on what you do " +
    "control, which is your own response, your next step, your limits and where your time goes. Acceptance is not " +
    "approval, and Let Them on its own slides into withdrawal, so Let Me is the half that matters.",
  thesis:
    "DBT is built on one central tension: accept reality exactly as it is, and at the same time work to change what can " +
    "be changed. Let Them / Let Me cuts that tension along one line, other people versus yourself. Let Them is the " +
    "acceptance pole, aimed at what others do, think and feel. Let Me is the change pole, aimed at your own next move. " +
    "DBT fills in the method the slogan lacks: skills to cool the body before choosing (STOP, TIPP), a way to test your " +
    "reading of events (Check the Facts), and scripts for the many times accepting is not enough and you have to ask, " +
    "refuse or negotiate (DEAR MAN, GIVE, FAST). DBT also turns acceptance inward: Let Me includes letting yourself " +
    "have the feeling without judging it.",
  letThem: {
    idea:
      "Treat other adults' behaviour, opinions and feelings as theirs to own. Instead of arguing, chasing, fixing, " +
      "persuading or replaying it, let the person be who they are right now, and read what they do as information about " +
      "them. Allowing it is not endorsing it; you are just not pouring energy into something you cannot steer.",
    covers: [
      "Their decisions, plans and priorities, including leaving you out",
      "What they think or say about you, including criticism and gossip",
      "Their emotional reactions: disappointment, anger, sulking, outbursts",
      "Relatives who still see you through old family roles",
      "Advantages others have that you cannot change",
      "Friendships drifting as distance, life stage or energy shift",
      "Whether and when another adult decides to change a habit",
      "The consequences another adult meets because of their own choices",
      "A partner's real level of interest and commitment, as shown by what they consistently do",
      "Someone choosing to end a relationship or move on",
    ],
    practice: [
      "Notice the spike: tight chest, rehearsing arguments, checking their profile, wanting to text again.",
      "Name what belongs to them (their choice, view or mood) and say 'let them' to yourself.",
      "Settle your body before deciding anything: one slow breath with a longer out-breath, and wait for the first surge to pass.",
      "Time-horizon check: will this matter in an hour, a week, a year? If not, drop it. If so, take it into Let Me.",
      "Read the pattern as information. What someone repeatedly does tells you more than promises or potential.",
      "Check you are not using it to dodge something: danger, abuse, discrimination or a real need to negotiate call for speaking up, not letting go.",
    ],
  },
  letMe: {
    idea:
      "Once you have let go of what you cannot control, move that energy onto what you can: your reaction, your next " +
      "concrete step, your limits, your values and how you spend your time. This turns acceptance into self-respect and " +
      "progress rather than withdrawal.",
    covers: [
      "Choosing your response instead of reacting on autopilot",
      "Deciding what you want and taking one small step towards it",
      "Setting and keeping limits on time, money, contact and topics",
      "Taking the first step in friendships: inviting, reaching out, organising",
      "Making the right call even when guilt says otherwise",
      "Using envy as a clue to your own goals",
      "Modelling a change yourself instead of pushing someone else to make it",
      "Helping on terms you set, rather than absorbing the results of their choices",
      "Asking directly for clarity in a relationship, and deciding whether to stay",
      "Looking after your own body and nerves: breathing, rest, movement",
    ],
    practice: [
      "Ask: given that they will do what they do, what do I want, and what is one action I can take today?",
      "Choose a response that fits your values, not one meant to win, punish or earn their approval.",
      "Turn a recurring frustration into a limit you will act on ('I will leave if the shouting starts'), not a demand they must meet.",
      "To influence someone, stop the nagging, ask open questions, step back and watch, celebrate real progress, and model the change yourself.",
      "To support someone, help in ways that build their ability (conditions, check-ins, resources) rather than absorbing their consequences.",
      "Review now and then: where is my energy going, and does it match what matters to me?",
    ],
  },
  concepts: [
    { name: "Both halves, in order", text: "Let Them lets go of control over other adults; Let Me takes charge of your own response. Stopping after the first half turns into resignation." },
    { name: "Stress and the nervous system", text: "Small social threats can set off the same fight-or-flight response as real danger, which narrows thinking. Pausing and breathing out slowly gives the thinking brain time to come back." },
    { name: "Letting people think what they think", text: "You cannot stop others forming opinions of you, and they will sometimes be wrong. Act on your values anyway, and let your respect for your own effort count more than their verdict." },
    { name: "Not managing other adults' emotions", text: "Each adult is responsible for regulating their own feelings. You can be kind and acknowledge how they feel without fixing it, absorbing it or matching it." },
    { name: "Guilt is not a verdict", text: "A good decision can still feel bad, especially when it disappoints someone. Discomfort does not prove you were wrong." },
    { name: "Comparison as information", text: "Envy points at something you want. Separate what cannot be learned (luck, background) from what can (habits, skills), let go of the first and study the second." },
    { name: "Adult friendship takes effort", text: "Friendships fade when proximity, timing or energy shift, often without anyone doing anything wrong. Someone has to start; Let Me means being willing to be that person." },
    { name: "People change when they want to", text: "Pressure makes adults push back because they want to feel in charge of their own choices. Your most reliable influence is modelling the change and making it easy." },
    { name: "Rescue versus support", text: "Repeatedly shielding an adult from the results of their choices can keep them stuck. Support acknowledges their pain, believes they can cope, and comes with clear conditions." },
    { name: "Believe the pattern", text: "In relationships, let what someone consistently does tell you how invested they are, instead of betting on who they might become." },
  ],
};

/**
 * Where Let Them / Let Me points into DBT. Each entry is one thing to let them do,
 * or one thing to let me do, and the skills that do it (ids in skills.js).
 */
export const MAPPINGS = [
  { side: "them", what: "Act how they choose: their behaviour, plans and decisions", skills: ["radical-acceptance", "turning-the-mind", "willingness"], why: "Their behaviour is a fact already under way. Radical acceptance acknowledges it fully without approving it; turning the mind is choosing that acceptance again each time the 'they shouldn't' thought returns." },
  { side: "them", what: "Think what they think about you", skills: ["check-the-facts", "nonjudgmental-stance", "self-validation"], why: "An opinion lives in someone else's head and is not a measurement of you. Check the Facts separates what you know from what you fear they think." },
  { side: "them", what: "Feel what they feel: anger, disappointment, hurt", skills: ["validation", "give", "walking-the-middle-path"], why: "You can treat their feeling as understandable without taking on the job of fixing it. Both are true: their pain is real, and regulating it is theirs to do." },
  { side: "them", what: "Stay the same: the pattern keeps repeating", skills: ["radical-acceptance", "pros-and-cons", "clarifying-priorities"], why: "Treat the pattern as the likely future, not a glitch. Then weigh realistic options and decide what matters most here: the outcome, the relationship or your self-respect." },
  { side: "them", what: "Leave, move on, exclude or forget you", skills: ["radical-acceptance", "self-soothe", "improve", "opposite-action"], why: "The loss is real and accepting it hurts at first. Self-soothe and IMPROVE carry you through the sharp part; opposite action counters the urge to chase, check or hide." },
  { side: "them", what: "Have what you want: success, partners, attention", skills: ["what-skills", "check-the-facts", "build-mastery"], why: "Envy is information about your own values. Name it plainly, check whether the comparison is fair, then channel the energy into your own path." },
  { side: "them", what: "Misunderstand you, or be wrong about you", skills: ["wise-mind", "clarifying-priorities", "pros-and-cons"], why: "Not every misunderstanding is worth correcting. Wise mind asks whether setting the record straight serves your actual goal (it often does when your job or safety is involved)." },
  { side: "me", what: "Pause before I react", skills: ["stop", "tipp"], why: "Let Me only works if you choose your move rather than fire off the first urge. STOP buys a gap; TIPP calms the body fast when you are too flooded to think." },
  { side: "me", what: "Notice and name what I feel", skills: ["what-skills", "self-validation", "nonjudgmental-stance"], why: "Acceptance points inward too. Putting the emotion, the body sensation and the urge into words, and telling yourself it makes sense, cools it down." },
  { side: "me", what: "Decide what I actually want from this", skills: ["wise-mind", "clarifying-priorities", "pros-and-cons"], why: "Let Me needs a target. Rank the outcome, the relationship and your self-respect for this situation, and lead with the skill for the top one." },
  { side: "me", what: "Ask, say no or negotiate", skills: ["dear-man", "give", "fast"], why: "The slogan says little about how to make a request. DEAR MAN gives the structure, GIVE protects the relationship, FAST protects your self-respect." },
  { side: "me", what: "Set and keep a limit", skills: ["boundary-building", "fast", "dear-man", "cope-ahead"], why: "A boundary is a statement about what you will do, not an order to someone else, so it sits on the Let Me side. Say it once, rehearse the pushback, follow through." },
  { side: "me", what: "Act against an urge that isn't helping", skills: ["opposite-action", "check-the-facts"], why: "When the emotion doesn't fit the facts, or acting on it would backfire, do the opposite of what it urges: approach instead of avoid, speak gently instead of attack." },
  { side: "me", what: "Solve the part of the problem that is mine", skills: ["problem-solving", "cope-ahead"], why: "Once acceptance clears away the fight with what others are doing, what is left is a practical problem: define it, brainstorm, pick one option, rehearse." },
  { side: "me", what: "Look after my body and build my own life", skills: ["abc-please", "build-mastery", "accumulate-positives"], why: "Resilience rests on sleep, food, movement and a steady supply of pleasant and competence-building activities. This is the long-term Let Me." },
  { side: "me", what: "Get through this moment without making it worse", skills: ["accepts", "improve", "self-soothe", "tipp"], why: "Some moments can be survived but not solved yet. Distracting, soothing and making the moment more bearable are legitimate actions when used to ride a wave." },
  { side: "me", what: "Talk to myself like a fair coach", skills: ["positive-self-talk", "self-validation"], why: "Swap the automatic harsh line for one that is both true and encouraging, so Let Me does not become a self-improvement whip." },
  { side: "me", what: "Understand them and repair the relationship", skills: ["think", "give", "validation"], why: "Letting them be who they are does not have to mean distance. THINK and validation keep the connection alive while you accept their choices." },
  { side: "both", what: "Shared situations, where their choice lands on me", skills: ["walking-the-middle-path", "wise-mind", "willingness"], why: "Many situations are not purely theirs or mine. The middle path accepts what they will do and still negotiates the part that lands on both of you." },
];

/**
 * Where Let Them is the wrong tool. Said whenever the guide sorts a situation, so
 * acceptance is never offered as a way to tolerate harm.
 */
export const EXCEPTIONS = [
  { name: "Abuse, threats or danger", text: "Never 'let them' hurt, threaten, coerce or control you or anyone else. Radical acceptance here means admitting it is really happening so you can act: a safety plan, leaving, reporting, emergency services." },
  { name: "Someone at risk of suicide or self-harm", text: "Don't step back. Take it seriously, stay with them, and connect them with crisis services or emergency help." },
  { name: "Dependants", text: "Children, and adults in your care, are yours to keep safe. Accept their feelings and low-risk choices; dangerous choices need limits, supervision and action." },
  { name: "Workplace issues to escalate", text: "Harassment, discrimination, safety risks, legal breaches, and pay or credit disputes that affect you: document them and escalate through a manager, HR, a union or legal advice." },
  { name: "Shared problems", text: "Joint money, co-parenting, shared housing, team deliverables: their choices land on you, so it needs joint problem-solving and negotiation, not just acceptance." },
  { name: "Opinions that hold facts", text: "Criticism sometimes contains accurate information worth acting on. Check the facts before deciding it is just their opinion." },
  { name: "Your own feelings", text: "Let Them is about other people. Your own emotions need accepting too (validated, named, felt), not pushed away in the name of letting go." },
];

/**
 * The flow an assistant walks a person through, from regulate to act. Step 0 is
 * not optional and is never skipped.
 */
export const FLOW = [
  { step: "Safety first", text: "Is anyone in danger right now: you, a child, someone in your care, or the other person? If yes, stop here and get help (emergency services, a crisis line, a domestic abuse service). Nothing below applies to danger." },
  { step: "Pause", text: "STOP: freeze the urge to send, say or do something. Step back, physically or in your head." },
  { step: "Bring the intensity down", text: "If it is around 7/10 or more, use TIPP first: breathing out longer than you breathe in, cold water on the face, or a minute of hard movement (skip the cold and the hard exercise with a heart condition, low heart rate, beta blockers or an eating disorder), until you can think in full sentences." },
  { step: "Say what happened", text: "In plain words: the facts, what you feel, where you feel it in your body, and what you want to do." },
  { step: "Validate yourself", text: "Tell yourself why this reaction makes sense given what happened and your history. No judging the feeling." },
  { step: "Check the facts", text: "What is my interpretation? What else could explain it? Does the size of my reaction fit?" },
  { step: "Sort it", text: "Theirs: their actions, words, opinions, feelings, decisions and pace of change. Mine: my reactions, words, limits, requests, time and next step. Shared: anything that lands on both of us and needs agreement." },
  { step: "Let them", text: "For what is theirs, practise radical acceptance: it happened, or this is how they are, whether or not I like it. Turn the mind back each time the 'should' returns." },
  { step: "Check the exceptions", text: "Does anything in 'theirs' involve abuse, a dependant, a workplace issue to escalate, or a shared problem? Move it to 'mine' or 'shared'. Acceptance does not cover those." },
  { step: "Wise mind", text: "What do I want out of this? Rank the outcome, the relationship and my self-respect for this situation." },
  { step: "Let me", text: "Choose one action that fits the ranking: ask (DEAR MAN), protect the relationship (GIVE), protect self-respect (FAST), set a limit, solve, act opposite to an unhelpful urge, or look after yourself (ABC PLEASE)." },
  { step: "Cope ahead", text: "Rehearse the conversation or the next hard moment, including how they might react and what you will do then." },
  { step: "Small step, soon", text: "Take the smallest version of the action within a day. Afterwards, notice the result without judging it and give yourself credit for acting." },
];
