// Phase 2 fresh idea — sourced from Ideabrowser #4150 (Last 20).
module.exports = {
  slug: 'last-20-builder-rescue',
  title: 'Last 20: Phone-a-Friend for Stuck Builders',
  description:
    'An on-demand network that matches vibe coders stuck on the last 20 percent of a build with an expert who has hit that exact wall, for a 15-minute screen-share rescue.',
  tagline: 'The tools to start are everywhere now. The help to finish is not.',
  shortDescription:
    'Upload your code, describe the block, get matched with an expert who has solved it before. Fifteen minutes on a screen share. Ship it.',
  solutionShort:
    'An on-demand marketplace that connects stuck builders with vetted experts for short, scoped screen-share sessions to clear the last 20 percent.',
  category: 'saas',
  applicationCategory: 'BusinessApplication',
  buildTime: '10',
  revenueGoal: '5k-month',
  publishedAt: '2026-06-09',
  tools: ['claude', 'cursor', 'lovable', 'replit', 'bolt'],
  audiences: ['solo-founders', 'non-technical', 'side-hustlers'],

  problem: [
    'The prototype works. The core features are there. But something broke and you cannot figure out what. The AI keeps giving you the same wrong answer. Stack Overflow has nothing. The tutorial you followed is three months old and the API has changed twice since.',
    'This is the new normal. Vibe coding lets anyone build fast. Cursor, Replit, Lovable, Bolt: idea to working prototype in a weekend. But the last stretch, the weird edge case, the integration that will not integrate, the error message that does not exist on Google, is where projects stall. And where they stay.',
    'The painful part is how close these projects are. The builder is at 80 percent, blocked on a single concrete problem that an experienced developer would recognize in thirty seconds. They do not need a contractor for a two-week engagement or a course. They need fifteen minutes with someone who has already been past this exact wall.',
  ],
  solution: [
    'Last 20 is the phone-a-friend for builders who are almost there. Upload your code, describe the block, and get matched with an expert who has hit that wall before and knows the way around it. Fifteen minutes on a screen share. Problem solved. Ship it.',
    'Experts set their own rates and the platform takes a cut. Hobbyists pay per session for one-off rescues; agencies that cannot afford stalled client work pay an annual plan for priority access. The product is scoped intentionally narrow: not mentorship, not freelancing, just a fast, specific unblock at the moment of maximum frustration. Every rescue is a natural referral, because the builder just watched their dead project come back to life.',
  ],
  steps: [
    'Build the request flow: a builder uploads a code snippet or repo link, describes the block, and tags the stack so matching has signal.',
    'Build matching and scheduling: route the request to available experts who know that stack and let one claim it for a 15-minute screen share.',
    'Add payments and a post-session referral loop: experts set rates, the platform takes 10 percent, and a solved rescue prompts a share.',
  ],

  market: [
    'The supply of stuck builders is exploding precisely because the tools got good. Every new vibe coder who ships an 80-percent prototype is a future Last 20 customer the moment they hit a wall their AI cannot clear. The frustration is loud, public, and easy to find.',
    'Growth lives where the frustration lives: Reddit threads full of anyone-else-hit-this-error, AI YouTube comment sections, and agency Slack channels asking whether anyone has shipped a given integration before. Start with a handful of experts and a handful of stuck builders, prove the rescue, and let every save turn into a referral.',
  ],
  marketPoints: [
    'Vibe-coding tools have created a wave of builders who reach 80 percent and stall',
    'Reddit and Discord are full of recurring, specific anyone-hit-this-error posts',
    'Agencies lose real money to a single stalled client integration',
    'The pain is acute and time-sensitive, which drives willingness to pay on the spot',
  ],
  competitive: [
    'The existing options are mismatched to the problem: too slow, too broad, or the very thing that already failed the builder. None deliver a fast, scoped, 15-minute unblock.',
  ],
  competitors: [
    { name: 'Upwork / Fiverr', pricing: '10-20% fees', note: 'Built for full projects with onboarding and proposals. Far too slow and heavy for a single 15-minute block.' },
    { name: 'Stack Overflow', pricing: 'Free', note: 'Asynchronous and context-free. Useless when your error does not exist on Google and you need help now.' },
    { name: 'Codementor', pricing: '~$1/min', note: 'Closest analog, but oriented to longer mentoring sessions rather than instant, scoped rescue at the moment of breakage.' },
    { name: 'ChatGPT / Claude', pricing: '$20/mo', note: 'The thing that already failed them. Great for the first 80 percent, unreliable on the gnarly last 20.' },
  ],
  competitiveGap:
    'No platform is purpose-built for the instant, scoped, 15-minute rescue of a vibe-coding builder stuck on one concrete block. The two-sided liquidity is the hard part, but the narrow scope makes each match fast and the value obvious.',

  business: [
    'The model is a take rate on expert-set pricing, with an annual plan for the buyers who feel the pain most. Hobbyists pay per rescue; agencies pay yearly for priority access because one stalled client build costs more than the plan.',
    'A blended take of roughly 10 to 20 dollars per session means a few hundred rescues a month, or a modest base of agency plans, clears 5K. The honest risk is marketplace liquidity: you must keep enough vetted experts online that a stuck builder gets matched quickly. Seed supply first, concentrate demand in one stack, and expand once the match time is consistently low.',
  ],
  pricing: [
    { name: 'Hobbyist', price: '$15-50/session', desc: 'Pay per 15-minute rescue. Expert sets the rate; the platform takes 10 percent.' },
    { name: 'Agency', price: '$99-499/yr', desc: 'Priority matching and a roster of vetted experts for teams that cannot afford stalled client work.' },
    { name: 'Expert', price: 'Keep 90%', desc: 'Experts set their own rates and earn from rescues between or alongside their main work.' },
  ],
  unitEconomics: [
    { value: '10%', label: 'Platform take rate' },
    { value: '~300', label: 'Rescues/mo to ~$5K' },
    { value: '15 min', label: 'Typical session length' },
    { value: '10 hrs', label: 'Weekend MVP scope' },
  ],

  techIntro: [
    'The MVP is a scheduling and payments marketplace, not heavy engineering. The early bottleneck is trust and match speed, so build the request and matching loop first and keep everything else minimal.',
  ],
  tech: [
    { layer: 'App', choice: 'Next.js + Supabase', why: 'Auth, request storage, and expert profiles with minimal backend so you can focus on the matching loop.' },
    { layer: 'Matching', choice: 'Stack tags + availability queue', why: 'Routes each block to online experts who know that stack; simple to start, easy to tune as volume grows.' },
    { layer: 'Sessions', choice: 'Embedded screen share (Daily / Whereby)', why: 'Drop-in 15-minute video with screen share without building real-time infrastructure yourself.' },
    { layer: 'Payments', choice: 'Stripe Connect', why: 'Expert payouts and the platform take rate handled with marketplace-ready billing primitives.' },
  ],

  prompts: {
    setup:
      'Build a Next.js + Supabase app where a stuck builder submits a rescue request: a code snippet or repo link, a description of the block, and stack tags (e.g. Next.js, Stripe, Supabase). Store requests with a status field. Give me the schema, the submission form, and the request list.',
    core:
      'Build the matching and scheduling flow. When a rescue request is created, notify available experts whose stack tags overlap. Let one expert claim it, which opens a 15-minute scheduled screen-share slot. Handle the claim race so only one expert gets it. Give me the queue logic and the claim endpoint.',
    landing:
      'Write a landing page for Last 20, a phone-a-friend service that matches stuck builders with experts for a 15-minute screen-share rescue. Hero, how-it-works, who-its-for (hobbyists and agencies), a comparison vs Upwork and Stack Overflow, pricing, and dual CTAs (get unstuck / become an expert). Energetic, builder-to-builder tone. Semantic HTML with Tailwind.',
    branding:
      'Create a brand kit for Last 20: a positioning line about finishing the last 20 percent, a 5-word tagline set, an energetic color palette with hex codes, an icon concept, and 5 launch posts aimed at Reddit build-in-public and AI-coding communities.',
    extraTitle: 'Stripe Connect Payouts',
    extra:
      'Add Stripe Connect to Last 20 so experts get paid and the platform keeps a 10 percent take. On a completed session, capture payment from the builder, transfer 90 percent to the expert connected account, and record the platform fee. Handle refunds for no-shows. Give me the Connect onboarding flow and the payout logic.',
  },

  related: [
    { slug: 'vibe-coders-for-hire', title: 'Vibe Coders for Hire', category: 'saas' },
    { slug: 'ai-code-coach-tutor', title: 'Code Coach: AI That Teaches You As You Build', category: 'developer-tools' },
  ],
};
