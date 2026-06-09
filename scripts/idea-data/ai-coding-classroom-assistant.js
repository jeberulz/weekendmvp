// Phase 2 fresh idea — sourced from Ideabrowser #7149 (Handraised).
module.exports = {
  slug: 'ai-coding-classroom-assistant',
  title: 'Handraised: AI Teaching Assistant for Coding Classrooms',
  description:
    'An in-editor AI assistant that flags stuck students on a live instructor dashboard and nudges them with hints, so coding bootcamps catch dropouts before they fall behind.',
  tagline: 'The instructor who can see the whole room teaches a different class.',
  shortDescription:
    'A VS Code assistant plus instructor dashboard that shows who is progressing, who is stuck, and who quietly stopped working, in real time.',
  solutionShort:
    'A classroom tool that watches each student editor in real time, gives contextual hints, and shows instructors a live map of who is stuck.',
  category: 'ai-tools',
  applicationCategory: 'EducationalApplication',
  buildTime: '12',
  revenueGoal: '5k-month',
  publishedAt: '2026-06-09',
  tools: ['claude', 'cursor', 'windsurf', 'replit'],
  audiences: ['developers', 'solo-founders'],

  problem: [
    'Bootcamp completion rates determine enrollment numbers, and enrollment determines revenue. Completion depends on whether students get unstuck fast enough to keep momentum through the program. The instructor is the only feedback mechanism, and every minute a student waits for help is a minute closer to falling behind permanently.',
    'The classroom has a structural blind spot. A student who is quietly stuck looks identical to a student who is quietly working. The ones who need help most are often the least likely to raise a hand. By the time an instructor notices, the student has spent twenty minutes spiraling on a missing bracket and decided they are just not cut out for this.',
    'The business model runs on a feedback loop the school has no tool to measure. A program that moves completion from 70 to 80 percent keeps an additional cohort worth of tuition that would otherwise be refunded or lost to dropout, but no off-the-shelf tool gives instructors a live view of where the room actually is.',
  ],
  solution: [
    'Handraised sits inside each student VS Code editor and watches what they write in real time. When a student stops typing, hits a repeated error, or falls behind the class pace, the system flags them on the instructor live dashboard. The student receives a contextual hint that explains the problem without giving away the answer.',
    'The instructor sees a room-wide view: who is progressing, who is stuck, and who stopped working five minutes ago without asking for help. The hint engine teaches rather than solves, so it supports the curriculum instead of short-circuiting it. The product lives or dies on instructor trust, so accuracy of the flags is the core metric from day one.',
  ],
  steps: [
    'Build the VS Code extension that streams lightweight progress signals (typing pauses, diagnostics, test pass rate) to a central room session.',
    'Build the instructor dashboard: a live grid of students color-coded by progressing, stuck, or idle, with drill-in on the blocking error.',
    'Add the hint engine that explains the problem without giving the answer, and a feedback control so instructors rate each flag for accuracy.',
  ],

  market: [
    'The buyer is an institution with a measurable ROI and a budget. Bootcamps, university CS departments, and corporate developer-training programs all live or die on completion and engagement, and they already pay for tooling per seat.',
    'The wedge is the live stuck-student signal, which no general classroom tool provides. Land two or three bootcamps, prove that flagged students get help faster and complete at higher rates, then expand into universities and corporate training on the same engine.',
  ],
  marketPoints: [
    'Coding bootcamps compete directly on completion and job-placement rates',
    'A 10-point completion lift can mean a full cohort of recovered tuition per term',
    'University CS intro courses face the same silent-struggler problem at larger scale',
    'Corporate developer training teams need engagement signals they currently lack',
  ],
  competitive: [
    'Existing classroom tools manage assignments and submissions. None give the instructor a real-time map of who is stuck right now, which is the exact moment intervention matters.',
  ],
  competitors: [
    { name: 'GitHub Classroom', pricing: 'Free', note: 'Great for distributing and collecting assignments, but offers no live, in-progress signal of who is struggling.' },
    { name: 'Replit Teams for Education', pricing: 'from $20/mo', note: 'A shared coding environment, but instructors still cannot see real-time stuck signals across a whole room.' },
    { name: 'Generic LMS (Canvas)', pricing: 'Institutional', note: 'Tracks grades and submissions after the fact, not the live moment a student is blocked.' },
    { name: 'Manual TAs', pricing: '$$$ labor', note: 'The current solution. Effective but does not scale and cannot watch every editor at once.' },
  ],
  competitiveGap:
    'The unmet need is a live, room-wide view of student progress tied to contextual hints. Instructor adoption plus accurate flags creates a data advantage that compounds across cohorts and is hard for a generic LMS to replicate.',

  business: [
    'Sell to the school, not the student. A per-school annual license priced around full platform access (student seats plus instructor tools) aligns with how bootcamps already buy, and the ROI argument writes itself when completion is the metric.',
    'At 1,500 dollars per year per school, roughly 40 schools clear 5K per month, and each renewal happens at the institution level rather than seat by seat. Distribution is direct partnerships, starting with two or three pilot bootcamps whose results become the case study.',
  ],
  pricing: [
    { name: 'Pilot', price: 'Free', desc: 'A capped three-month pilot for one cohort, in exchange for flag-accuracy feedback and a case study.' },
    { name: 'School', price: '$1,500/yr', desc: 'Full platform access: student seats, instructor dashboard, and the hint engine.' },
    { name: 'Institution', price: 'Custom', desc: 'University departments and corporate training with SSO, multi-cohort analytics, and admin controls.' },
  ],
  unitEconomics: [
    { value: '$1,500/yr', label: 'Per-school license' },
    { value: '~40', label: 'Schools to $5K MRR' },
    { value: '+10pts', label: 'Target completion lift' },
    { value: '12 hrs', label: 'Weekend MVP scope' },
  ],

  techIntro: [
    'The build is a streaming extension plus a real-time dashboard. Keep the signals lightweight so the privacy story is clean and the latency is low; the AI only runs when a student is actually stuck.',
  ],
  tech: [
    { layer: 'Client', choice: 'VS Code extension (TypeScript)', why: 'Runs in the environment students already use and streams only progress signals, not keystrokes.' },
    { layer: 'Realtime', choice: 'Supabase Realtime channels', why: 'Powers the live instructor grid with per-room presence and status updates out of the box.' },
    { layer: 'AI', choice: 'Claude for hint generation', why: 'Produces hints that explain the blocking problem without revealing the answer, on demand.' },
    { layer: 'Dashboard', choice: 'Next.js + Tailwind', why: 'A fast instructor view that color-codes the room and drills into any student blocker.' },
  ],

  prompts: {
    setup:
      'Build a VS Code extension in TypeScript that streams lightweight progress signals to a Supabase Realtime channel keyed by a room code: typing-active vs idle, count of unresolved diagnostics, and the pass rate of the current test file. No keystroke capture. Give me the extension scaffold and the channel schema.',
    core:
      'Build an instructor dashboard in Next.js that subscribes to a Supabase Realtime room and renders a live grid of students, each color-coded green (progressing), amber (stuck: repeated error or idle while behind), or grey (idle). Clicking a student shows their current blocking diagnostic. Give me the components and the subscription logic.',
    landing:
      'Write a landing page for Handraised, an AI teaching assistant that shows coding instructors who is stuck in real time. Hero, how-it-works, an ROI section framed on completion rates, a comparison vs GitHub Classroom, pricing ($1,500/yr per school), and a book-a-pilot CTA. Trustworthy, education-buyer tone. Semantic HTML with Tailwind.',
    branding:
      'Create a brand kit for Handraised: a positioning line about giving instructors a live view of the whole room, a 5-word tagline set, a calm academic color palette with hex codes, an icon concept, and 5 outreach messages aimed at bootcamp directors.',
    extraTitle: 'Flag Accuracy Tuning',
    extra:
      'Add a flag-accuracy feedback loop to Handraised. Each time the system flags a student as stuck, let the instructor mark it accurate or not. Store the outcome and use it to tune the stuck thresholds per cohort. If instructors override more than 30 percent of flags, surface a recalibration prompt. Give me the data model and the threshold logic.',
  },

  related: [
    { slug: 'ai-code-coach-tutor', title: 'Code Coach: AI That Teaches You As You Build', category: 'developer-tools' },
    { slug: 'ai-code-reviewer', title: 'AI Code Reviewer', category: 'developer-tools' },
  ],
};
