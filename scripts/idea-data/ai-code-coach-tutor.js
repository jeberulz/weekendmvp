// Phase 2 fresh idea — sourced from Ideabrowser #4060 (Code Coach).
module.exports = {
  slug: 'ai-code-coach-tutor',
  title: 'Code Coach: AI That Teaches You As You Build',
  description:
    'An in-editor AI tutor that explains your code line by line as you write it, so self-taught devs and bootcamp grads finally understand what they shipped, not just that it works.',
  tagline: 'A silent second brain in the editor margin that teaches the why behind every line.',
  shortDescription:
    'The in-editor AI tutor that explains your code as you write it. Built for self-taught developers who can ship but cannot explain what they shipped.',
  solutionShort:
    'A VS Code extension that explains code line by line in plain English, shows why errors happen, and turns everyday coding into real understanding.',
  category: 'developer-tools',
  applicationCategory: 'DeveloperApplication',
  buildTime: '10',
  revenueGoal: '5k-month',
  publishedAt: '2026-06-09',
  tools: ['claude', 'cursor', 'windsurf', 'replit'],
  audiences: ['developers', 'solo-founders', 'weekend-builders'],

  problem: [
    'You watched a hundred tutorials. Every concept was explained. But when the cursor blinks on an empty file, nothing comes. The gap between following along and knowing how to code is wider than any video can close, and it is the single most common complaint in learning communities. r/learnprogramming has 4.3 million members, and a huge share of the threads are some version of the same question: I finished the course, so why can I still not build anything on my own?',
    'AI made the gap worse, not better. Autocomplete and chat assistants made shipping easier and made learning optional. The code gets written. The understanding does not. The crutch becomes permanent. New developers paste in a working function they could not write themselves and could not debug if it broke, because no tool ever told them why it works.',
    'The pain is acute and increasing. Self-taught developers and bootcamp graduates can assemble an app from snippets but freeze when an interviewer asks them to explain a loop, or when a production bug lands and the AI that wrote the code is no help reading it. They do not need another tool that writes code faster. They need one that makes them better.',
  ],
  solution: [
    'Code Coach lives in the editor and teaches as you work. It is not a chatbot in a separate tab. Highlight a function you do not understand and get a plain-English breakdown of what it does and why. Hover over an error and see what caused it and how to fix it, with the reasoning, not just the patch. Write a loop that works but feels wrong and learn why it is inefficient and what is better.',
    'The extension watches for the moments that matter: long pauses, repeated errors, and code that runs but is fragile. When it spots one, it offers a short, contextual explanation tied to the exact line on screen. The teaching happens inside the work, not in a course you switch to and forget. It starts with Python, the most common first language, then expands to JavaScript, React, and data science.',
  ],
  steps: [
    'Scaffold a VS Code extension with a command that sends the highlighted code and surrounding context to Claude and renders the explanation inline.',
    'Add the core teaching loop: detect errors and pauses, then surface a why-focused explanation tied to the exact line, with a follow-up question prompt.',
    'Ship a landing page with a 60-second demo GIF and a free Python tier, then gate advanced languages and saved learning paths behind Pro.',
  ],

  market: [
    'The wedge is a fast-growing slice of a large education market. The global online tutoring market is forecast to reach roughly USD 23.73 billion by 2030, and the AI coding assistant market is expanding alongside it. Every major assistant today optimizes for productivity. None optimize for comprehension inside the editor, which is exactly the gap learners describe.',
    'Demand shows up as concrete community signals, not guesses. The audience already gathers in places you can reach for free, and they are vocal about wanting interactive, in-editor help rather than another set of videos.',
  ],
  marketPoints: [
    '4.3M members in r/learnprogramming regularly asking how to bridge tutorials and real building',
    '247K members in r/AI_Agents discussing gaps in current AI coding assistants',
    '185K members in r/vscode actively requesting smarter in-editor tooling',
    'Coding YouTube channels with 500K to 1M+ subscribers driving constant tool-comparison demand',
  ],
  competitive: [
    'The big assistants are adjacent, not competitive. They make experienced developers faster; they do not teach beginners why. That leaves an open lane for a learning-first tool that lives in the same editor.',
  ],
  competitors: [
    { name: 'GitHub Copilot', pricing: '$10/mo', note: 'Best-in-class autocomplete, but writes code without explaining the why. Speeds up people who already understand.' },
    { name: 'Cursor', pricing: '$20/mo', note: 'A productivity-first AI editor. Powerful for shipping, not designed to teach the underlying logic.' },
    { name: 'Codecademy', pricing: '$17.49/mo', note: 'Strong structured courses, but learning happens off to the side, not inside the project you actually care about.' },
    { name: 'Exercism', pricing: 'Free', note: 'Great mentored exercises, but the teaching is on curated problems, not the messy code in your own repo.' },
  ],
  competitiveGap:
    'No existing tool teaches inside your own code, in real time, focused on why it works. Tight VS Code integration plus a learner-first explanation engine is hard to copy because the incumbents are committed to a productivity story.',

  business: [
    'Freemium fits the audience: price-sensitive learners who will pay once a tool visibly accelerates their understanding. The free Python tier is the top of the funnel; Pro unlocks every language plus saved learning paths; institutions pay per seat.',
    'The path to 5K per month is short. At 19 dollars a month, roughly 260 Pro subscribers clear it, and a single bootcamp or school deal covers a large slice of that in one signature. Distribution runs through the exact communities above, plus partnerships with coding YouTubers and bootcamps that want better completion rates.',
  ],
  pricing: [
    { name: 'Free', price: '$0', desc: 'Python only, core in-editor explanations. The hook that proves value before the upgrade.' },
    { name: 'Pro', price: '$19/mo', desc: 'All languages, saved learning paths, error coaching, and progress tracking for serious self-learners.' },
    { name: 'Bootcamps', price: 'from $5K/yr', desc: 'Per-seat licensing with an instructor view. One deal is worth hundreds of individual subscriptions.' },
  ],
  unitEconomics: [
    { value: '$19/mo', label: 'Pro price point' },
    { value: '~260', label: 'Pro users to $5K MRR' },
    { value: '< $2', label: 'AI cost per active user (Haiku-tier)' },
    { value: '10 hrs', label: 'Weekend MVP scope' },
  ],

  techIntro: [
    'This is a weekend-buildable extension, not a research project. The hard part is product judgment about when to teach, not exotic infrastructure. Lean on a fast, cheap model for the high-frequency explanations and reserve a stronger model for deep dives.',
  ],
  tech: [
    { layer: 'Client', choice: 'VS Code extension (TypeScript)', why: 'Meets learners where they already work and ships through the Marketplace for instant distribution.' },
    { layer: 'AI', choice: 'Claude (Haiku for inline, Sonnet for deep dives)', why: 'Strong code reasoning and plain-English explanations; Haiku keeps per-explanation cost and latency low.' },
    { layer: 'Context', choice: 'Local AST parsing + selection context', why: 'Sends only the relevant code and surrounding scope, so explanations stay accurate and cheap.' },
    { layer: 'Backend', choice: 'Supabase + Stripe + PostHog', why: 'Auth, usage metering, billing, and product analytics with almost no server code to maintain.' },
  ],

  prompts: {
    setup:
      'Build a VS Code extension in TypeScript called Code Coach. Add a command Explain This that takes the current selection plus the enclosing function and file language, sends it to the Claude API, and renders the response in an inline hover and a side panel. Include settings for API key and model. Give me the full scaffold and package.json.',
    core:
      'Implement the teaching loop for my VS Code extension. Detect three triggers: a diagnostic error on the active line, a pause of 8+ seconds after typing, and code flagged as working-but-fragile. For each, call Claude with a prompt that explains WHY in plain English, tied to the exact line, and ends with one follow-up question. Debounce calls and cache by code hash.',
    landing:
      'Write a single-page landing site for Code Coach, an in-editor AI tutor for self-taught developers. Hero, a 3-step how-it-works, a comparison against Copilot and Codecademy, pricing (Free, Pro $19/mo, Bootcamps), and an email capture. Match a clean, light, founder-friendly aesthetic. Output semantic HTML with Tailwind.',
    branding:
      'Create a brand kit for Code Coach: a name rationale, a one-line positioning statement (teaches the why, not just the what), a 5-word tagline set, a calm developer-friendly color palette with hex codes, and 5 launch tweet hooks aimed at r/learnprogramming and coding YouTube audiences.',
    extraTitle: 'Freemium Gating',
    extra:
      'Add usage metering and freemium gating to my Code Coach extension. Free tier: Python only, 25 explanations per day. Pro: unlimited, all languages, saved learning paths. Use Supabase to track usage per user, Stripe for the Pro subscription, and show an upgrade nudge when a free user hits the cap. Give me the schema and the gate logic.',
  },

  related: [
    { slug: 'ai-code-reviewer', title: 'AI Code Reviewer', category: 'developer-tools' },
    { slug: 'api-documentation-generator', title: 'AI API Documentation Generator', category: 'developer-tools' },
  ],
};
