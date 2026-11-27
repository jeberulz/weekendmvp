import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import type { StarterKitCopy, StarterKitResource } from "@/lib/landing/read-starter-kit";

import { CopyPromptButton } from "./CopyPromptButton";

/** Legacy `.prompt-box` page style, resolved to utilities. */
const PROMPT_BOX = "bg-[#f5f2ed] border border-[#e5e0d8]";

/* -------------------------------------------------------------------------
 * Page sections (server components — preserve legacy pixel-for-pixel markup)
 * ---------------------------------------------------------------------- */

export function KitHero({ copy }: { copy: StarterKitCopy["hero"] }) {
  return (
    <header id="intro" className="mb-20 scroll-mt-40">
      <h1 className="text-4xl md:text-6xl font-medium tracking-tight mb-8">
        {copy.heading}
      </h1>
      <p className="text-xl text-neutral-500 font-light leading-relaxed mb-10">
        {copy.intro}{" "}
        <span className="text-black font-medium underline decoration-neutral-200">
          {copy.demo}
        </span>
        ,{" "}
        <span className="text-black font-medium underline decoration-neutral-200">
          {copy.share}
        </span>
        , and{" "}
        <span className="text-black font-medium underline decoration-neutral-200">
          {copy.collect}
        </span>{" "}
        {copy.outcomeTail}
      </p>
      <p className="mb-10 text-neutral-600">
        {copy.relatedLead}{" "}
        <Link href="/5-to-9-starter" className="font-medium text-black underline underline-offset-4">{copy.starterLabel}</Link>
        {" "}{copy.relatedJoin}{" "}
        <Link href="/guides/5-to-9-builder" className="font-medium text-black underline underline-offset-4">{copy.builderLabel}</Link>.
      </p>

      <div className="bg-black text-white rounded-[2rem] p-8 md:p-10">
        <h3 className="text-lg font-medium mb-6">
          {copy.checklistHeading}
        </h3>
        <ul className="space-y-4 text-neutral-300">
          {copy.deliverables.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircle2
                className="text-white mt-1"
                size={18}
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

export function RulesSection({ copy }: { copy: StarterKitCopy["rules"] }) {
  return (
    <section id="rules" className="scroll-mt-40">
      <h2 className="text-3xl font-medium mb-8">
        {copy.heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6">
            {copy.includeHeading}
          </h4>
          <ul className="space-y-4">
            {copy.include.map(({ strong, rest }) => (
              <li key={strong} className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-black mt-2"></div>
                <span>
                  <strong>{strong}</strong>
                  {` ${rest}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-red-500">
            {copy.excludeHeading}
          </h4>
          <ul className="space-y-4 text-neutral-500">
            {copy.exclude.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm italic">
                <X className="mt-1" size={14} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 p-8 bg-neutral-100 rounded-3xl">
        <h4 className="text-sm font-semibold mb-6">
          {copy.screensHeading}
        </h4>
        <div className="flex flex-col md:flex-row gap-4">
          {[copy.screens.landing, copy.screens.input, copy.screens.output].map((screen, index) => (
            <div
              key={index}
              className="flex-1 p-4 bg-white rounded-xl border border-neutral-200"
            >
              <span className="text-xs font-bold text-neutral-400">
                {index + 1}
              </span>
              <p className="text-sm font-medium mt-1">{screen.title}</p>
              <p className="text-xs text-neutral-500 mt-1">{screen.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepBadge({ n }: { n: string }) {
  return (
    <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
      {n}
    </span>
  );
}

export function Step1Scorecard({ copy }: { copy: StarterKitCopy["scorecard"] }) {
  return (
    <section id="step-1" className="scroll-mt-40">
      <div className="flex items-center gap-4 mb-6">
        <StepBadge n="Step 1" />
        <h2 className="text-3xl font-medium tracking-tight">
          {copy.heading}
        </h2>
      </div>
      <p className="text-neutral-500 mb-10">
        {copy.intro}
      </p>

      <div className="space-y-4">
        {copy.questions.map((question) => (
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
        {copy.note}
      </p>
    </section>
  );
}

export function Step2Spec({ copy }: { copy: StarterKitCopy["spec"] }) {
  return (
    <section id="step-2" className="scroll-mt-40">
      <div className="flex items-center gap-4 mb-6">
        <StepBadge n="Step 2" />
        <h2 className="text-3xl font-medium tracking-tight">
          {copy.heading}
        </h2>
      </div>
      <p className="text-neutral-500 mb-10">
        {copy.intro}
      </p>

      <div className={`${PROMPT_BOX} rounded-3xl p-8 space-y-6`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
              {copy.nameLabel}
            </p>
            <div className="h-10 border-b border-neutral-300"></div>
          </div>
          <div>
            <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
              {copy.customerLabel}
            </p>
            <div className="h-10 border-b border-neutral-300"></div>
          </div>
        </div>
        <div>
          <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
            {copy.promiseLabel}
          </p>
          <div className="h-10 border-b border-neutral-300"></div>
        </div>
        <div>
          <p className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
            {copy.metricLabel}
          </p>
          <ul className="mt-4 space-y-2 text-xs text-neutral-500">
            {copy.metrics.map((metric, index) => <li key={index}>{`• ${metric}`}</li>)}
          </ul>
        </div>
      </div>

      {/* Prompt for Step 2 */}
      <div className="mt-8 space-y-4">
        <div
          className={`${PROMPT_BOX} rounded-2xl p-6 relative group border-dashed`}
        >
          <CopyPromptButton
            text={copy.prompt}
            className="absolute top-4 right-4 text-neutral-400 hover:text-black transition-colors"
          />
          <div className="pr-8">
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
              {copy.promptHeading}
            </p>
            <p className="text-xs font-mono text-neutral-600 leading-relaxed italic">
              {copy.prompt}
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6 relative group bg-black text-white">
          <CopyPromptButton
            text={copy.advancedPrompt}
            className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
          />
          <div className="pr-8">
            <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
              {copy.advancedHeading}
            </p>
            <p className="text-xs font-mono text-neutral-300 leading-relaxed italic">
              {copy.advancedPrompt}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Step3Plan({ copy }: { copy: StarterKitCopy["plan"] }) {
  return (
    <section id="step-3" className="scroll-mt-40">
      <div className="flex items-center gap-4 mb-6">
        <StepBadge n="Step 3" />
        <h2 className="text-3xl font-medium tracking-tight">
          {copy.heading}
        </h2>
      </div>

      <div className="space-y-12">
        <div className="relative pl-8 border-l border-neutral-200">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
          <h4 className="text-lg font-medium mb-4">
            {copy.fridayHeading}
          </h4>
          <ul className="space-y-2 text-sm text-neutral-500">
            {copy.fridayTasks.map((task, index) => <li key={index}>{task}</li>)}
          </ul>
        </div>

        <div className="relative pl-8 border-l border-neutral-200">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
          <h4 className="text-lg font-medium mb-4">{copy.saturdayHeading}</h4>
          <div className="space-y-6">
            {copy.saturdayTasks.map((b) => (
              <div key={b.label}>
                <p className="text-xs font-bold text-black uppercase mb-2">
                  {b.label}
                </p>
                <p className="text-sm text-neutral-500">{b.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative pl-8 border-l border-neutral-200">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-black"></div>
          <h4 className="text-lg font-medium mb-4">
            {copy.sundayHeading}
          </h4>
          <ul className="space-y-2 text-sm text-neutral-500">
            {copy.sundayTasks.map((task, index) => <li key={index}>{task}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Step4Ideas({ resource }: { resource: StarterKitResource<"ideas"> }) {
  const copy = resource.value;
  return (
    <section id="step-4" className="scroll-mt-40">
      <div className="flex items-center gap-4 mb-6">
        <StepBadge n={`Step ${resource.step}`} />
        <h2 className="text-3xl font-medium tracking-tight">
          {resource.heading}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {copy.ideas.map((idea) => (
          <div
            key={idea.title}
            className="p-6 bg-white border border-neutral-200 rounded-3xl hover:border-black transition-colors group"
          >
            <h4 className="font-medium mb-2">{idea.title}</h4>
            <p className="text-xs text-neutral-500">{idea.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Step5Prompts({ resource }: { resource: StarterKitResource<"prompts"> }) {
  const copy = resource.value;
  return (
    <section id="step-5" className="scroll-mt-40">
      <div className="flex items-center gap-4 mb-6">
        <StepBadge n={`Step ${resource.step}`} />
        <h2 className="text-3xl font-medium tracking-tight">{resource.heading}</h2>
      </div>
      <p className="text-neutral-500 mb-10">
        {copy.intro}
      </p>

      <div className="grid grid-cols-1 gap-6">
        {copy.prompts.map((prompt, index) => (
          <div
            key={`${index + 1}. ${prompt.title}`}
            className={`${PROMPT_BOX} rounded-3xl p-6 relative group`}
          >
            <CopyPromptButton
              text={prompt.text}
              className="absolute top-4 right-4 text-neutral-400 hover:text-black transition-colors"
            />
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-neutral-400">
              {`${index + 1}. ${prompt.title}`}
            </h4>
            <p className="text-xs font-mono text-neutral-600 leading-relaxed italic">
              {prompt.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TemplatesSection({ resource }: { resource: StarterKitResource<"templates"> }) {
  const copy = resource.value;
  return (
    <section id="templates" className="scroll-mt-40">
      <h2 className="text-3xl font-medium mb-12">{copy.heading}</h2>

      <div className="space-y-20">
        <div>
          <h3 className="text-xl font-medium mb-6">{copy.wireframeHeading}</h3>
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
                    {copy.waitlistLabel}
                  </div>
                  <div className="h-2 w-32 bg-neutral-100 rounded-full"></div>
                </div>
              </div>

              {/* Benefits Wireframe */}
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="w-8 h-8 bg-neutral-100 rounded-lg"></div>
                    <div className="h-2 w-full bg-neutral-200 rounded-full"></div>
                    <div className="h-2 w-2/3 bg-neutral-100 rounded-full"></div>
                  </div>
                ))}
              </div>

              {/* How it works Wireframe */}
              <div className="bg-neutral-50 rounded-2xl p-6 space-y-4">
                <div className="h-3 w-24 bg-neutral-300 rounded-full"></div>
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[8px] font-bold">
                        {n}
                      </div>
                      <div className="h-2 flex-1 bg-neutral-200 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-medium mb-6">{copy.outreachHeading}</h3>
          <div className="bg-neutral-900 text-white p-8 rounded-3xl font-mono text-sm leading-relaxed">
            <p className="text-neutral-500 mb-4">{copy.outreachLabel}</p>
            <p>
              {copy.outreachScript}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
