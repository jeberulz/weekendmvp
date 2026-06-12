import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2, X } from "lucide-react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { CopyPromptButton } from "./CopyPromptButton";
import { StarterKitShell } from "./StarterKitShell";
import { SubscribedModal } from "./SubscribedModal";

const TITLE = "Weekend MVP Starter Kit | Build your product in 48 hours";
const DESCRIPTION =
  "The exact 48-hour plan, templates, and AI prompts to build and launch your weekend MVP. Created by John Iseghohi.";
const OG_DESCRIPTION =
  "Follow the exact 48-hour plan, templates, and AI prompts to build and launch your weekend MVP. Created by John Iseghohi.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/starter-kit" },
  openGraph: {
    type: "website",
    url: "https://weekendmvp.app/starter-kit",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: "https://weekendmvp.app/image/og-image.png",
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: OG_DESCRIPTION,
    images: ["https://weekendmvp.app/image/og-image.png"],
  },
};

const STARTER_KIT_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://weekendmvp.app/#person",
      name: "John Iseghohi",
      jobTitle: "Creator",
      url: "https://cal.com/switchtoux",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://weekendmvp.app/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Starter Kit",
          item: "https://weekendmvp.app/starter-kit",
        },
      ],
    },
    {
      "@type": "HowTo",
      name: "Build a Weekend MVP in 48 Hours",
      description:
        "A step-by-step guide to picking an idea, building a 3-screen MVP, and launching a waitlist by Sunday night.",
      creator: { "@id": "https://weekendmvp.app/#person" },
      step: [
        {
          "@type": "HowToStep",
          name: "Friday Night: Strategy & Scope",
          text: "Pick the idea using the scorecard, write the one-page spec, draft landing page copy, and decide your tool stack.",
        },
        {
          "@type": "HowToStep",
          name: "Saturday: Build Day",
          text: "Setup the project, build the core flow (input form, transformation logic, and output page), and deploy the landing page.",
        },
        {
          "@type": "HowToStep",
          name: "Sunday: Distribution Day",
          text: "Create demo assets, reach out to 10 potential testers via DM, and post your build story on social media.",
        },
      ],
    },
  ],
};

const SPEC_PROMPT = `"Act as a Product Manager. Help me write a one-page spec for my Weekend MVP. My idea is: [DESCRIBE YOUR IDEA]. Generate: 1. A short, punchy MVP Name. 2. A specific target Customer. 3. A one-sentence Promise. 4. The single Core Action. 5. The primary Output. 6. A realistic Success Metric for a 48-hour build. Keep it brief and high-impact."`;

const ADVANCED_SPEC_PROMPT = `"I am building a Weekend MVP. Based on the concept [PASTE CONCEPT], generate a comprehensive one-page spec. Include: User Personas, Core User Story, Technical Constraints (No Auth/No Payments), 3-Screen Architecture (Landing/Input/Output), and a 48-hour build roadmap. Structure the output as a clean markdown document ready for a developer."`;

const SCORECARD_QUESTIONS = [
  "Can I build the core flow in 8\u201312 hours?",
  "Can I demo it in 15 seconds?",
  "Do I know where to find 10 target users?",
  "Does it solve a real \u201Cannoying\u201D problem?",
];

const MVP_IDEAS: Array<{ title: string; description: string }> = [
  {
    title: "Meeting Minutes Cleaner",
    description: "Input: messy notes → Output: clean summary + action items",
  },
  {
    title: "Resume Bullet Rewriter",
    description: "Input: JD + current bullet → Output: improved bullet",
  },
  {
    title: "Cold DM Writer",
    description: "Input: profile + goal → Output: 3 DM variations",
  },
  {
    title: "Creator Hook Generator",
    description: "Input: topic + audience → Output: 20 scroll-stopping hooks",
  },
  {
    title: "\u201CWhat Should I Build?\u201D Idea Narrower",
    description: "Input: skills + interests → Output: 3 weekend MVP ideas + scope",
  },
  {
    title: "Gym Routine Generator",
    description: "Input: days + equipment → Output: simple 7-day workout plan",
  },
  {
    title: "Meal Plan From Ingredients",
    description: "Input: fridge contents → Output: 3 simple meals + shopping list",
  },
  {
    title: "Budget Splitter for Couples",
    description:
      "Input: monthly expenses → Output: who owes what + clean breakdown",
  },
  {
    title: "Interview Answer Builder (STAR)",
    description: "Input: role + experience → Output: STAR method answer draft",
  },
  {
    title: "Personal Brand Bio Generator",
    description:
      "Input: role + proof → Output: LinkedIn headline + bio + about section",
  },
];

const BUILD_PROMPTS: Array<{ title: string; text: string }> = [
  {
    title: "1. Meeting Minutes Cleaner",
    text: `"Act as an MVP Architect. I'm building a Meeting Minutes Cleaner. Customer: Busy Managers. Pain: Hours spent re-writing messy notes. Promise: Clean summary in 60 seconds. Core Action: Paste raw notes. Output: Action items + key decisions. Help me define the technical logic to parse text and handle edge cases like incomplete sentences."`,
  },
  {
    title: "2. Resume Bullet Rewriter",
    text: `"Act as a Career Coach. I'm building a Resume Bullet Rewriter. Customer: Job seekers. Pain: Vague resume bullets that don't land interviews. Promise: Metrics-driven bullets in seconds. Core Action: Paste JD + current bullet. Output: Improved bullet with keywords. Give me 10 specific 'Action Verbs' and metrics patterns the logic should prioritize."`,
  },
  {
    title: "3. Cold DM Writer",
    text: `"Act as a Sales Strategist. I'm building a Cold DM Writer. Customer: Freelancers/Sellers. Pain: High rejection rates from boring DMs. Promise: 3 high-conversion variations. Core Action: Paste recipient profile + goal. Output: 3 personalized DMs. Help me structure the prompt logic to ensure the output is concise, non-spammy, and includes a clear CTA."`,
  },
  {
    title: "4. Creator Hook Generator",
    text: `"Act as a Content Viral Specialist. I'm building a Creator Hook Generator. Customer: Content Creators. Pain: Low engagement on social posts. Promise: 20 scroll-stopping hooks. Core Action: topic + audience. Output: Hooks + 5 angles. Create a library of 5 'Hook Frameworks' (e.g., The Contrarian, The Mystery) that the generator should use."`,
  },
  {
    title: "5. Idea Narrower",
    text: `"Act as an MVP Coach. I'm building an Idea Narrower. Customer: Want-to-be builders. Pain: Decision paralysis. Promise: 3 shippable ideas + scope. Core Action: Skills + interests. Output: Ideas + weekend plan. Help me design a scoring system that automatically ranks ideas based on 'Shippability' and 'Market Need'."`,
  },
  {
    title: "6. Gym Routine Generator",
    text: `"Act as a Personal Trainer. I'm building a Gym Routine Generator. Customer: Beginners. Pain: Intimidated by the gym/equipment. Promise: 7-day plan in 30 seconds. Core Action: Days + equipment. Output: Simple routine. Help me define the mapping logic for equipment (e.g., if 'Dumbbells only' → show 'DB Goblet Squats' instead of 'Barbell')."`,
  },
  {
    title: "7. Meal Plan Generator",
    text: `"Act as a Nutritionist. I'm building a Meal Plan From Ingredients. Customer: Busy parents. Pain: Food waste + 'what's for dinner?' stress. Promise: 3 meals + shopping list. Core Action: Fridge contents. Output: Meal plan. Help me create a simple data structure to handle common ingredient substitutions."`,
  },
  {
    title: "8. Budget Splitter",
    text: `"Act as a Financial Planner. I'm building a Budget Splitter for Couples. Customer: Modern couples. Pain: Awkward money conversations. Promise: Fair split in 1 minute. Core Action: Monthly expenses. Output: Clean breakdown. Define the 'Fair Split' algorithm (e.g., proportional to income vs. 50/50) and how to present it without friction."`,
  },
  {
    title: "9. STAR Answer Builder",
    text: `"Act as an Interview Coach. I'm building an Interview Answer Builder. Customer: Candidates. Pain: Rambling during behavioral questions. Promise: STAR answer draft. Core Action: Role + experience. Output: Structured answer. Help me create the 'Transformation Logic' that takes a raw story and sorts it into Situation, Task, Action, and Result."`,
  },
  {
    title: "10. Personal Brand Bio Generator",
    text: `"Act as a Personal Branding Expert. I'm building a Bio Generator. Customer: Professionals. Pain: Invisible or boring LinkedIn profiles. Promise: Headline + Bio in seconds. Core Action: Role + proof. Output: Full LinkedIn section. Define 3 'Brand Archetypes' (e.g., The Expert, The Builder, The Strategist) for the generator to use."`,
  },
];

/** Legacy `.prompt-box` page style, resolved to utilities. */
const PROMPT_BOX = "bg-[#f5f2ed] border border-[#e5e0d8]";

export default function StarterKitPage() {
  return (
    <div className="bg-[#fcfaf7] text-[#1a1a1a] min-h-screen selection:bg-black/10 selection:text-black">
      <JsonLd schema={STARTER_KIT_SCHEMA} />

      <Suspense fallback={null}>
        <SubscribedModal />
      </Suspense>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <StarterKitShell>
          {/* Hero */}
          <header id="intro" className="mb-20 scroll-mt-40">
            <h1 className="text-4xl md:text-6xl font-medium tracking-tight mb-8">
              Weekend MVP Starter Kit
            </h1>
            <p className="text-xl text-neutral-500 font-light leading-relaxed mb-10">
              Ship a tiny product in 48 hours that you can{" "}
              <span className="text-black font-medium underline decoration-neutral-200">
                demo
              </span>
              ,{" "}
              <span className="text-black font-medium underline decoration-neutral-200">
                share
              </span>
              , and{" "}
              <span className="text-black font-medium underline decoration-neutral-200">
                collect emails
              </span>{" "}
              for.
            </p>

            <div className="bg-black text-white rounded-[2rem] p-8 md:p-10">
              <h3 className="text-lg font-medium mb-6">
                By Sunday night you&rsquo;ll have:
              </h3>
              <ul className="space-y-4 text-neutral-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-white mt-1"
                    size={18}
                    aria-hidden="true"
                  />
                  <span>A live link or working demo</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-white mt-1"
                    size={18}
                    aria-hidden="true"
                  />
                  <span>A simple landing page + waitlist</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-white mt-1"
                    size={18}
                    aria-hidden="true"
                  />
                  <span>A 15&ndash;30 sec demo video</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-white mt-1"
                    size={18}
                    aria-hidden="true"
                  />
                  <span>10 people invited to try it via DM outreach</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-white mt-1"
                    size={18}
                    aria-hidden="true"
                  />
                  <span>A LinkedIn post driving signups</span>
                </li>
              </ul>
            </div>
          </header>

          <div className="space-y-40">
            {/* The Rules */}
            <section id="rules" className="scroll-mt-40">
              <h2 className="text-3xl font-medium mb-8">
                The rules (this is what makes it shippable)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6">
                    Must Include
                  </h4>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-black mt-2"></div>
                      <span>
                        <strong>One user type</strong> (be specific)
                      </span>
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-black mt-2"></div>
                      <span>
                        <strong>One core action</strong> (one job)
                      </span>
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-black mt-2"></div>
                      <span>
                        <strong>One clear output</strong> (what they get)
                      </span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-red-500">
                    Must NOT Include
                  </h4>
                  <ul className="space-y-4 text-neutral-500">
                    <li className="flex items-start gap-3 text-sm italic">
                      <X className="mt-1" size={14} aria-hidden="true" />
                      <span>login/accounts</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm italic">
                      <X className="mt-1" size={14} aria-hidden="true" />
                      <span>payment</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm italic">
                      <X className="mt-1" size={14} aria-hidden="true" />
                      <span>complex dashboards</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm italic">
                      <X className="mt-1" size={14} aria-hidden="true" />
                      <span>&quot;perfect UI&quot;</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-12 p-8 bg-neutral-100 rounded-3xl">
                <h4 className="text-sm font-semibold mb-6">
                  The 3-screen MVP (always)
                </h4>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 p-4 bg-white rounded-xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400">1</span>
                    <p className="text-sm font-medium mt-1">Landing page</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Promise + Waitlist
                    </p>
                  </div>
                  <div className="flex-1 p-4 bg-white rounded-xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400">2</span>
                    <p className="text-sm font-medium mt-1">Input screen</p>
                    <p className="text-xs text-neutral-500 mt-1">A short form</p>
                  </div>
                  <div className="flex-1 p-4 bg-white rounded-xl border border-neutral-200">
                    <span className="text-xs font-bold text-neutral-400">3</span>
                    <p className="text-sm font-medium mt-1">Output screen</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Result + Join waitlist
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 1 */}
            <section id="step-1" className="scroll-mt-40">
              <div className="flex items-center gap-4 mb-6">
                <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Step 1
                </span>
                <h2 className="text-3xl font-medium tracking-tight">
                  Pick a shippable idea
                </h2>
              </div>
              <p className="text-neutral-500 mb-10">
                Use this scorecard. Pick the highest total. Score each 1&ndash;5.
              </p>

              <div className="space-y-4">
                {SCORECARD_QUESTIONS.map((question) => (
                  <div
                    key={question}
                    className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-2xl"
                  >
                    <span className="text-sm">{question}</span>
                    <div className="flex gap-1">
                      <div className="w-8 h-2 bg-neutral-100 rounded-full"></div>
                      <div className="w-8 h-2 bg-neutral-100 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-sm text-neutral-500 italic p-4 border-l-2 border-black bg-neutral-50">
                &quot;If your idea scores low on &apos;demo in 15
                seconds&apos;, kill it or shrink it.&quot;
              </p>
            </section>

            {/* Step 2 */}
            <section id="step-2" className="scroll-mt-40">
              <div className="flex items-center gap-4 mb-6">
                <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Step 2
                </span>
                <h2 className="text-3xl font-medium tracking-tight">
                  Write a one-page MVP spec
                </h2>
              </div>
              <p className="text-neutral-500 mb-10">
                Fill this in. No fancy doc needed. Keep it to one page.
              </p>

              <div className={`${PROMPT_BOX} rounded-3xl p-8 space-y-6`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      MVP Name
                    </p>
                    <div className="h-10 border-b border-neutral-300"></div>
                  </div>
                  <div>
                    <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Customer
                    </p>
                    <div className="h-10 border-b border-neutral-300"></div>
                  </div>
                </div>
                <div>
                  <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                    The Promise
                  </p>
                  <div className="h-10 border-b border-neutral-300"></div>
                </div>
                <div>
                  <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                    Success Metric for this weekend
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-neutral-500">
                    <li>&bull; 10 emails collected</li>
                    <li>&bull; 5 people complete the flow</li>
                    <li>&bull; 3 people reply &ldquo;I&rsquo;d use this&rdquo;</li>
                  </ul>
                </div>
              </div>

              {/* Prompt for Step 2 */}
              <div className="mt-8 space-y-4">
                <div
                  className={`${PROMPT_BOX} rounded-2xl p-6 relative group border-dashed`}
                >
                  <CopyPromptButton
                    text={SPEC_PROMPT}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-black transition-colors"
                  />
                  <div className="pr-8">
                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
                      AI Prompt: Generate your spec
                    </p>
                    <p className="text-xs font-mono text-neutral-600 leading-relaxed italic">
                      {SPEC_PROMPT}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl p-6 relative group bg-black text-white">
                  <CopyPromptButton
                    text={ADVANCED_SPEC_PROMPT}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
                  />
                  <div className="pr-8">
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
                      Advanced Prompt: Full Spec Doc
                    </p>
                    <p className="text-xs font-mono text-neutral-300 leading-relaxed italic">
                      {ADVANCED_SPEC_PROMPT}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 3 */}
            <section id="step-3" className="scroll-mt-40">
              <div className="flex items-center gap-4 mb-6">
                <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Step 3
                </span>
                <h2 className="text-3xl font-medium tracking-tight">
                  The 48-hour plan
                </h2>
              </div>

              <div className="space-y-12">
                <div className="relative pl-8 border-l border-neutral-200">
                  <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
                  <h4 className="text-lg font-medium mb-4">
                    Friday night (30&ndash;45 mins)
                  </h4>
                  <ul className="space-y-2 text-sm text-neutral-500">
                    <li>Pick the idea (scorecard)</li>
                    <li>Write the one-page spec</li>
                    <li>Draft landing page copy</li>
                    <li>Decide your tool stack</li>
                  </ul>
                </div>

                <div className="relative pl-8 border-l border-neutral-200">
                  <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
                  <h4 className="text-lg font-medium mb-4">
                    Saturday (Build Day)
                  </h4>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold text-black uppercase mb-2">
                        Hour 1: Setup
                      </p>
                      <p className="text-sm text-neutral-500">
                        Create project, define 3 screens, basic layout.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-black uppercase mb-2">
                        Hours 2&ndash;5: Core Flow
                      </p>
                      <p className="text-sm text-neutral-500">
                        Build input form, output page, and transformation
                        logic.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-black uppercase mb-2">
                        Hour 6&ndash;8: Launch
                      </p>
                      <p className="text-sm text-neutral-500">
                        Add waitlist capture, deploy, and test on mobile.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative pl-8 border-l border-neutral-200">
                  <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
                  <h4 className="text-lg font-medium mb-4">
                    Sunday (Distribution Day)
                  </h4>
                  <ul className="space-y-2 text-sm text-neutral-500">
                    <li>Create demo assets (15s video)</li>
                    <li>Outreach: DM 10 people to test</li>
                    <li>LinkedIn: Post your build story</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Step 4 */}
            <section id="step-4" className="scroll-mt-40">
              <div className="flex items-center gap-4 mb-6">
                <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Step 4
                </span>
                <h2 className="text-3xl font-medium tracking-tight">
                  10 shippable MVP ideas
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MVP_IDEAS.map((idea) => (
                  <div
                    key={idea.title}
                    className="p-6 bg-white border border-neutral-200 rounded-3xl hover:border-black transition-colors group"
                  >
                    <h4 className="font-medium mb-2">{idea.title}</h4>
                    <p className="text-xs text-neutral-500">
                      {idea.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Step 5 */}
            <section id="step-5" className="scroll-mt-40">
              <div className="flex items-center gap-4 mb-6">
                <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Step 5
                </span>
                <h2 className="text-3xl font-medium tracking-tight">
                  10 Build Prompts
                </h2>
              </div>
              <p className="text-neutral-500 mb-10">
                Choose the idea you want to build and copy the prompt to dive
                deep into the implementation details with AI.
              </p>

              <div className="grid grid-cols-1 gap-6">
                {BUILD_PROMPTS.map((prompt) => (
                  <div
                    key={prompt.title}
                    className={`${PROMPT_BOX} rounded-3xl p-6 relative group`}
                  >
                    <CopyPromptButton
                      text={prompt.text}
                      className="absolute top-4 right-4 text-neutral-400 hover:text-black transition-colors"
                    />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-neutral-400">
                      {prompt.title}
                    </h4>
                    <p className="text-xs font-mono text-neutral-600 leading-relaxed italic">
                      {prompt.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Templates */}
            <section id="templates" className="scroll-mt-40">
              <h2 className="text-3xl font-medium mb-12">
                Templates &amp; Scripts
              </h2>

              <div className="space-y-20">
                <div>
                  <h3 className="text-xl font-medium mb-6">
                    Landing Page Wireframe
                  </h3>
                  <div className="border border-neutral-200 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                    {/* Browser Top Bar */}
                    <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-2 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-neutral-200"></div>
                      <div className="w-2 h-2 rounded-full bg-neutral-200"></div>
                      <div className="w-2 h-2 rounded-full bg-neutral-200"></div>
                      <div className="ml-4 h-3 w-32 bg-neutral-100 rounded-full"></div>
                    </div>

                    <div className="p-8 space-y-12">
                      {/* Nav Wireframe */}
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-20 bg-neutral-200 rounded-full"></div>
                        <div className="flex gap-4">
                          <div className="h-2 w-10 bg-neutral-100 rounded-full"></div>
                          <div className="h-2 w-10 bg-neutral-100 rounded-full"></div>
                        </div>
                      </div>

                      {/* Hero Wireframe */}
                      <div className="text-center space-y-4 py-8">
                        <div className="h-8 w-3/4 bg-neutral-900 mx-auto rounded-lg"></div>
                        <div className="h-4 w-1/2 bg-neutral-200 mx-auto rounded-lg"></div>
                        <div className="pt-4 flex flex-col items-center gap-3">
                          <div className="h-10 w-48 bg-black rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                            Join the Waitlist
                          </div>
                          <div className="h-2 w-32 bg-neutral-100 rounded-full"></div>
                        </div>
                      </div>

                      {/* Benefits Wireframe */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg"></div>
                          <div className="h-2 w-full bg-neutral-200 rounded-full"></div>
                          <div className="h-2 w-2/3 bg-neutral-100 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg"></div>
                          <div className="h-2 w-full bg-neutral-200 rounded-full"></div>
                          <div className="h-2 w-2/3 bg-neutral-100 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg"></div>
                          <div className="h-2 w-full bg-neutral-200 rounded-full"></div>
                          <div className="h-2 w-2/3 bg-neutral-100 rounded-full"></div>
                        </div>
                      </div>

                      {/* How it works Wireframe */}
                      <div className="bg-neutral-50 rounded-2xl p-6 space-y-4">
                        <div className="h-3 w-24 bg-neutral-300 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[8px] font-bold">
                              1
                            </div>
                            <div className="h-2 flex-1 bg-neutral-200 rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[8px] font-bold">
                              2
                            </div>
                            <div className="h-2 flex-1 bg-neutral-200 rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[8px] font-bold">
                              3
                            </div>
                            <div className="h-2 flex-1 bg-neutral-200 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-6">
                    Tester Outreach Script
                  </h3>
                  <div className="bg-neutral-900 text-white p-8 rounded-3xl font-mono text-sm leading-relaxed">
                    <p className="text-neutral-500 mb-4">
                      // DM to potential tester
                    </p>
                    <p>
                      &quot;Hey [Name], quick one. I&rsquo;m building a tiny
                      tool this weekend for [problem]. Can I send you a
                      15-second demo and ask 2 questions?&quot;
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Final CTA */}
          <section className="mt-40 p-12 bg-black rounded-[3rem] text-center">
            <h2 className="text-3xl font-medium text-white mb-6">
              Ready to build your Weekend MVP?
            </h2>
            <p className="text-neutral-400 mb-10 max-w-sm mx-auto">
              Take the next step and book a 1:1 sprint to ship your project in
              48 hours.
            </p>
            <NavExternalLink
              href="https://cal.com/switchtoux/mvp-sprint"
              className="inline-block px-10 py-4 bg-white text-black rounded-full font-semibold hover:bg-neutral-200 transition-all"
            >
              Book a Sprint
            </NavExternalLink>
          </section>
        </StarterKitShell>
      </div>
    </div>
  );
}
