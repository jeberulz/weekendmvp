/**
 * Static data driving the homepage composition. Hoisted out of `page.tsx`
 * so the page file stays composition-first.
 */

import {
  Bot,
  CalendarDays,
  Check,
  CheckCircle,
  ClipboardCheck,
  Cloud,
  GraduationCap,
  HeartPulse,
  Layers,
  MousePointerClick,
  Scissors,
  Sparkles,
  Store,
  Timer,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { AnthropicBrandIcon, CursorBrandIcon } from "@/components/marketing/BrandIcons";
import type { FaqEntry } from "@/lib/seo";

export const FAQS: FaqEntry[] = [
  { question: "Is this really free?", answer: "Yep. Free. Just useful." },
  { question: "Do I need to be a developer?", answer: "No. The kit is built for non-technical builders using AI tools." },
  { question: "What tools do I need?", answer: "Whatever you\u2019re comfortable with. The kit focuses on workflow, not hype stacks." },
  { question: "What will I have by Sunday night?", answer: "A demo you can show, a waitlist to collect emails, and a clear next step." },
  { question: "Will this help me pick an idea?", answer: "Yes. There\u2019s a scorecard and a short list of MVP ideas that are easy to ship." },
  { question: "Can you help me build it?", answer: "Yes. After you get the kit, you\u2019ll have the option to work with me 1:1 for a Weekend MVP Sprint." },
];

export const FEATURES: Array<{ icon: React.ReactNode; title: string; body: string }> = [
  { icon: <Timer size={20} aria-hidden="true" />, title: "The 15-second demo test", body: "Stop picking ideas that never ship. Validate feasibility instantly." },
  { icon: <Layers size={20} aria-hidden="true" />, title: "3-screen MVP template", body: "The golden structure: Landing Page \u2192 Input \u2192 Output." },
  { icon: <ClipboardCheck size={20} aria-hidden="true" />, title: "MVP idea scorecard", body: "Pick a buildable idea in 10 minutes based on real constraints." },
  { icon: <CalendarDays size={20} aria-hidden="true" />, title: "48-hour weekend plan", body: "Step-by-step itinerary: What to do Friday, Saturday, and Sunday." },
  { icon: <Scissors size={20} aria-hidden="true" />, title: "Scope-cutting checklist", body: "Slash features without second guessing to ensure you ship." },
  { icon: <Sparkles size={20} aria-hidden="true" />, title: "Copy-paste AI prompts", body: "Shrink your idea and unblock code issues fast with AI." },
];

export const PROCESS_STEPS: Array<{ title: string; body: string }> = [
  { title: "Pick an idea", body: "Use the scorecard to find a shippable idea. Discard the rest." },
  { title: "Build with templates", body: "Execute the 3-screen MVP using the provided templates and prompts." },
  { title: "Launch & Collect", body: "Launch your waitlist + demo and start collecting emails immediately." },
];

export const AUDIENCE_COLUMNS: Array<{ heading: string; headIcon: React.ReactNode; rowIcon: React.ReactNode; items: string[]; delay: string }> = [
  {
    heading: "This kit is for you if:",
    headIcon: <CheckCircle className="text-green-500" size={20} aria-hidden="true" />,
    rowIcon: <Check className="text-neutral-600 mt-0.5 min-w-[16px]" size={16} aria-hidden="true" />,
    items: [
      "You\u2019ve got side project ideas but don\u2019t know where to start.",
      "You\u2019re not technical (or you are, but you still want speed).",
      "You want something you can demo and post, not a half-built project.",
      "Your real goal is momentum, feedback, and an email list.",
    ],
    delay: "",
  },
  {
    heading: "Not for you if:",
    headIcon: <XCircle className="text-neutral-600" size={20} aria-hidden="true" />,
    rowIcon: <X className="text-neutral-600 mt-0.5 min-w-[16px]" size={16} aria-hidden="true" />,
    items: [
      "You\u2019re trying to build a full platform in a weekend.",
      "You want perfect UI before you ship anything.",
    ],
    delay: "delay-100",
  },
];

export const CATEGORIES: Array<{ href: string; label: string; tagline: string; icon: React.ReactNode; iconBg: string; delay: string }> = [
  { href: "/startup-ideas#saas", label: "SaaS", tagline: "Subscription software", icon: <Cloud className="text-blue-400" size={20} aria-hidden="true" />, iconBg: "bg-blue-500/10", delay: "delay-200" },
  { href: "/startup-ideas#ai", label: "AI Tools", tagline: "AI-powered products", icon: <Sparkles className="text-purple-400" size={20} aria-hidden="true" />, iconBg: "bg-purple-500/10", delay: "delay-200" },
  { href: "/startup-ideas#productivity", label: "Productivity", tagline: "Work smarter tools", icon: <Zap className="text-green-400" size={20} aria-hidden="true" />, iconBg: "bg-green-500/10", delay: "delay-300" },
  { href: "/startup-ideas#automation", label: "Automation", tagline: "Automate workflows", icon: <Bot className="text-orange-400" size={20} aria-hidden="true" />, iconBg: "bg-orange-500/10", delay: "delay-300" },
  { href: "/startup-ideas#health", label: "Health", tagline: "Wellness & fitness", icon: <HeartPulse className="text-red-400" size={20} aria-hidden="true" />, iconBg: "bg-red-500/10", delay: "delay-400" },
  { href: "/startup-ideas#marketplace", label: "Marketplace", tagline: "Connect buyers & sellers", icon: <Store className="text-cyan-400" size={20} aria-hidden="true" />, iconBg: "bg-cyan-500/10", delay: "delay-400" },
  { href: "/startup-ideas#education", label: "Education", tagline: "Learning platforms", icon: <GraduationCap className="text-yellow-400" size={20} aria-hidden="true" />, iconBg: "bg-yellow-500/10", delay: "delay-500" },
];

export const TOOLS: Array<{ href: string; label: string; tagline: string; hoverHint: string; icon: React.ReactNode; delay: string }> = [
  { href: "/startup-ideas", label: "Cursor", tagline: "AI Code Editor", hoverHint: "Full-stack projects \u2192", icon: <CursorBrandIcon className="text-white" size={32} />, delay: "delay-200" },
  { href: "/startup-ideas", label: "Claude", tagline: "AI Assistant", hoverHint: "Complex logic \u2192", icon: <AnthropicBrandIcon className="text-[#D4A574]" size={32} />, delay: "delay-300" },
  { href: "/startup-ideas", label: "Bolt.new", tagline: "Instant Apps", hoverHint: "Quick MVPs \u2192", icon: <Zap className="text-yellow-400" size={32} aria-hidden="true" />, delay: "delay-400" },
  { href: "/startup-ideas", label: "No-Code", tagline: "Visual Builders", hoverHint: "Non-technical \u2192", icon: <MousePointerClick className="text-emerald-400" size={32} aria-hidden="true" />, delay: "delay-500" },
];

export const FEATURED_IDEAS: Array<{ slug: string; title: string; description: string; categoryLabel: string; buildTime: string; badgeClass: string; delay: string }> = [
  { slug: "ai-brake-inspection-analyser", title: "AI-Powered Brake Inspection Analyser", description: "Use AI to analyze brake pad photos and provide instant wear assessment and replacement recommendations.", categoryLabel: "AI", buildTime: "~12 hours", badgeClass: "bg-purple-500/10 text-purple-400", delay: "delay-200" },
  { slug: "mobile-brake-repair-marketplace", title: "Marketplace for Mobile Brake Repair", description: "Connect car owners with mobile mechanics who come to their location for brake repairs.", categoryLabel: "Marketplace", buildTime: "~Weekend", badgeClass: "bg-cyan-500/10 text-cyan-400", delay: "delay-300" },
  { slug: "ai-meeting-notes-cleaner", title: "AI Meeting Notes Cleaner", description: "Transform messy meeting notes into structured action items, summaries, and follow-up tasks automatically.", categoryLabel: "SaaS", buildTime: "~12 hours", badgeClass: "bg-blue-500/10 text-blue-400", delay: "delay-400" },
];
