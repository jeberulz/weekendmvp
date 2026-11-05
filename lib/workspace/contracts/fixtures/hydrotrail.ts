/**
 * HydroTrail — the worked example from the launch-experience canvas, as one
 * valid instance of every crew artifact (C-ART). Long bodies are shortened.
 * Used by contract tests, eval graders and UI stories. Data only.
 */
import type {
  AdsDrafts,
  ArtifactByKind,
  Blueprint,
  BrandKit,
  BuildPack,
  BuildPrompt,
  EmailSequence,
  LandingSpec,
  LaunchPlan,
  RosterPlan,
  SeoPack,
  SocialPack,
} from "../artifacts";

export const hydrotrailBlueprint: Blueprint = {
  schemaVersion: 1,
  source: "library",
  ideaSlug: "hydrotrail",
  pitch: "A hydration planner that tells solo hikers how much water to carry and when to drink.",
  oneUser: "A solo day-hiker planning a long, hot route with few water sources.",
  oneLoop: "Plan a route, get litres to carry and sip reminders, log what you drank, plan the next route better.",
  features: [
    "Trail planner: distance, heat and climb → litres to carry",
    "Sip reminders paced to effort and temperature",
    "Water source list with the distance to the next one",
    "Quick drink log with one tap",
    "Offline access to plans and logs",
  ],
  profile: {
    ideaKind: "app",
    buyer: "consumer",
    deliveryFormat: "self_serve",
    audiencePlural: "hikers",
  },
  market: {
    summary:
      "Hikers already track routes, but hydration is left to rules of thumb. General water-reminder apps ignore heat, climb and distance between sources.",
    competitors: [
      { name: "Generic water reminder apps", note: "Fixed daily targets; nothing about the route or the heat." },
      { name: "Route planners", note: "Great maps and elevation; hydration is an afterthought." },
    ],
  },
  scopeCuts: [
    "No GPS tracking or live maps this weekend",
    "No wearables integration",
    "No social feed or sharing between hikers",
  ],
};

/** An own idea: a light blueprint, "Not yet validated", no market data (D15). */
export const ownIdeaLightBlueprint: Blueprint = {
  schemaVersion: 1,
  source: "own_idea",
  pitch: "A packing checklist that adapts to the weather forecast for weekend campers.",
  oneUser: "A weekend car-camper packing on Friday night.",
  oneLoop: "Enter the campsite and dates, get a checklist for the forecast, tick items off, reuse it next trip.",
  features: [
    "Checklist generated from the forecast",
    "Tick items off while packing",
    "Save and reuse a list for the next trip",
  ],
  profile: {
    ideaKind: "app",
    buyer: "consumer",
    deliveryFormat: "self_serve",
    audiencePlural: "campers",
  },
  scopeCuts: ["No gear shop links", "No shared family lists"],
};

export const hydrotrailRosterPlan: RosterPlan = {
  schemaVersion: 1,
  rulesVersion: "2026-11-05.1",
  ideaKind: "app",
  hired: [
    { roleKey: "lead", employeeName: "Wren", roleLabel: "Crew Lead", hiredBy: "rule", always: true, reason: "Routes approvals" },
    { roleKey: "brand", employeeName: "Iris", roleLabel: "Brand", hiredBy: "rule", always: true, reason: "Logo, palette, voice" },
    { roleKey: "landing", employeeName: "Leo", roleLabel: "Landing", hiredBy: "rule", always: true, reason: "Site and waitlist" },
    { roleKey: "seo", employeeName: "Sana", roleLabel: "SEO", hiredBy: "rule", always: true, reason: "People search for this problem" },
    { roleKey: "marketing", employeeName: "Marco", roleLabel: "Marketing", hiredBy: "rule", always: true, reason: "Owns 50 waitlist signups" },
    { roleKey: "email", employeeName: "Elle", roleLabel: "Email", hiredBy: "rule", always: true, reason: "Waitlist email sequence" },
    { roleKey: "social", employeeName: "Theo", roleLabel: "Social", hiredBy: "rule", always: true, reason: "Launch posts" },
    {
      roleKey: "engineering",
      employeeName: "Kai",
      roleLabel: "Engineering",
      hiredBy: "rule",
      always: true,
      weight: "full",
      reason: "An app: PRD slice and the 8-prompt build pack",
    },
    { roleKey: "ads", employeeName: "Ada", roleLabel: "Ads", hiredBy: "rule", always: false, reason: "Goal has a paid push: $7/day test" },
  ],
  skipped: [
    { roleKey: "merch", roleLabel: "Merch", reason: "An app; nothing physical to sell" },
    { roleKey: "outbound", roleLabel: "Outbound", reason: "Hikers come via communities and search" },
    { roleKey: "curriculum", roleLabel: "Curriculum", reason: "No course content" },
    { roleKey: "community", roleLabel: "Community", reason: "Not before the first 50 signups" },
  ],
};

export const hydrotrailBrandKit: BrandKit = {
  schemaVersion: 1,
  name: "HydroTrail",
  nameAlternatives: ["SipLine", "Trailwater"],
  tagline: { text: "Drink before you're thirsty.", emphasis: "thirsty." },
  palette: {
    primary: { name: "Glacier", hex: "#1F4E5F", use: "Buttons, headers, the logo lockup." },
    secondary: { name: "Stream", hex: "#8CC2D3", use: "Map lines, secondary fills, progress rings." },
    accent: { name: "Ember", hex: "#E07B2E", use: "Reminders and one highlight per screen. Never body text on light." },
    ground: { name: "Granite", hex: "#F2EEE6", use: "Page background and cards." },
    ink: { name: "Basalt", hex: "#13242A", use: "Body text, icons, dark panels." },
  },
  type: {
    heading: { family: "Archivo", weight: 800, notes: "ExtraBold, tight tracking, sentence case." },
    body: { family: "Geist", weight: 400, notes: "Regular for body, labels and UI." },
    scale: "H1 56/0.98 · H2 32/1.05 · Body 16/1.5",
  },
  voice: {
    traits: ["Calm", "Practical", "Trail-tested", "Never preachy"],
    say: "Sip now: 250 ml keeps you on pace for the climb.",
    dontSay: "You're dehydrated! Drink immediately!",
    dontSayWhy: "Alarm makes people ignore reminders; a calm nudge gets the sip.",
  },
  logo: {
    markDescription: "A single water drop whose inner line becomes a switchback trail climbing to a peak.",
    alt: "HydroTrail logo: a water drop with a switchback trail inside",
  },
  heroArt: {
    description: "A lone hiker on a dry ridge at golden hour, a bottle clipped to the pack. Swap for a photo in Studio.",
    alt: "A solo hiker on a sunlit ridge with a water bottle on their pack",
  },
  pattern: "Contour lines in Stream at 12% opacity, broken by small drop marks.",
  productMoment: { title: "Sip now · 250 ml", body: "6.2 km to the next source. You're on pace." },
};

export const hydrotrailLandingSpec: LandingSpec = {
  schemaVersion: 1,
  nav: {
    brandName: "HydroTrail",
    links: [
      { label: "How it works", target: "#how" },
      { label: "The app", target: "#app" },
    ],
    cta: { label: "Join the waitlist", target: "#waitlist" },
  },
  hero: {
    eyebrow: "Hydration for long solo routes",
    headline: { text: "Know your water. Drink before you're thirsty.", emphasis: "Drink before you're thirsty." },
    subhead:
      "HydroTrail turns distance, heat and climb into litres to carry, then reminds you to sip on pace, so you reach the next source with water to spare.",
    primaryCta: { label: "Join the waitlist", target: "#waitlist" },
    secondaryCta: { label: "See how it works", target: "#how" },
    reassurance: "Free at launch · Works in your phone's browser · Add it to your home screen",
    image: {
      description: "A lone hiker on a dry ridge at golden hour, a bottle clipped to the pack.",
      alt: "A solo hiker on a sunlit ridge with a water bottle on their pack",
    },
    productMoment: {
      title: "Sip now · 250 ml",
      body: "6.2 km to the next source. You're on pace.",
      caption: "An on-trail reminder",
    },
  },
  promises: {
    items: [
      { title: "Carry the right amount", body: "Litres from your route's distance, heat and climb, not a guess.", icon: "droplets" },
      { title: "Sip on pace", body: "Gentle reminders timed to effort, before thirst slows you down.", icon: "timer" },
      { title: "Know the next source", body: "See how far it is to water, even with no signal.", icon: "map-pin" },
    ],
  },
  how_it_works: {
    eyebrow: "How it works",
    heading: "Three steps before you leave the car park",
    steps: [
      { title: "Plan the route", body: "Enter distance, climb and the forecast high." },
      { title: "Pack the litres", body: "HydroTrail tells you what to carry and where to refill." },
      { title: "Sip on the trail", body: "Reminders keep you on pace; one tap logs each drink." },
    ],
  },
  app_preview: {
    addedByWeekendMvp: true,
    addedReason: "early-access app preview",
    eyebrow: "The app",
    heading: "Your water plan, in your pocket",
    body: "A planner, a reminder and a log in one mobile web app. Install it from your browser; it works offline on the trail.",
    cta: { label: "Get early access", target: "#waitlist" },
    screen: {
      description: "A phone showing today's plan: 2.4 L to carry, a sip reminder and the next source at 6.2 km.",
      alt: "HydroTrail on a phone: 2.4 litres to carry and the next water source 6.2 km ahead",
    },
  },
  waitlist: {
    addedByWeekendMvp: true,
    addedReason: "waitlist capture → your first goal",
    heading: "Be first on the trail",
    body: "Join the waitlist and get early access when HydroTrail opens.",
    emailLabel: "Email address",
    buttonLabel: "Join the waitlist",
    successMessage: "Almost there. Check {email} and confirm your address to join the list.",
  },
  footer: {
    closingLine: "Drink before you're thirsty.",
    cta: { label: "Join the waitlist", target: "#waitlist" },
    copyrightName: "HydroTrail",
  },
};

export const hydrotrailEmailSequence: EmailSequence = {
  schemaVersion: 1,
  name: "Waitlist launch sequence",
  trigger: "waitlist_join",
  senderName: "John at HydroTrail",
  emails: {
    welcome: {
      delayHours: 0,
      subject: "You're on the HydroTrail list",
      preview: "Thanks for confirming. One quick question before launch.",
      body:
        "Hi {first name},\n\nThanks for joining the HydroTrail waitlist. I'm building a planner that tells you how much water to carry and reminds you to sip on pace.\n\nOne question: what's the longest dry stretch you've hiked? Just hit reply.\n\nJohn",
      cta: { label: "Reply to John", target: "reply" },
      goal: "Reply rate",
    },
    value: {
      delayHours: 48,
      subject: "The 500 ml an hour rule (and when it fails)",
      preview: "Heat and climb change everything.",
      body:
        "Hi {first name},\n\nMost hikers start from 500 ml an hour. It works on a cool, flat day. Add 30°C and 600 m of climb and you can need nearly double.\n\nThat gap is what HydroTrail plans for.\n\nJohn",
      goal: "Opens",
    },
    offer: {
      delayHours: 72,
      subject: "Early access is open for the first 50",
      preview: "Your invite is inside.",
      body:
        "Hi {first name},\n\nEarly access is open for the first 50 people on the list. It's free at launch and works in your phone's browser.\n\nSign in with your email and plan your next route.\n\nJohn",
      cta: { label: "Get early access", target: "site" },
      goal: "Early-access sign-ins",
    },
    follow_up: {
      delayHours: 96,
      subject: "What should HydroTrail do next?",
      preview: "Vote on the next feature.",
      body:
        "Hi {first name},\n\nThree ideas are on the list: offline maps, a group plan, or a watch reminder. Reply with the one you'd use first.\n\nJohn",
      cta: { label: "Vote by reply", target: "reply" },
      goal: "Feature votes",
    },
  },
};

export const hydrotrailSocialPack: SocialPack = {
  schemaVersion: 1,
  posts: {
    fri: {
      kind: "launch",
      format: "image",
      hook: "I kept running dry on long solo hikes, so I'm building the fix.",
      caption:
        "HydroTrail tells you how much water to carry from distance, heat and climb, then reminds you to sip on pace. The waitlist is open: link in bio.",
      shortCaption: "HydroTrail plans the water you carry and paces your sips. Waitlist open: link in bio.",
      imageText: "Drink first",
      imageAlt: "Text card reading Drink first over a contour-line pattern",
      hashtags: ["hiking", "solohiking", "hydration"],
    },
    sat: {
      kind: "value",
      format: "carousel",
      hook: "500 ml an hour is a starting point, not a plan.",
      caption: "Slide through how heat and climb change what you need to carry. Save it for your next hot route.",
      shortCaption: "Heat and climb change what you need to carry. Save this for your next hot route.",
      imageText: "500 ml / hr",
      imageAlt: "Carousel cover reading 500 ml per hour",
      hashtags: ["hikingtips", "trailrunning"],
    },
    sun: {
      kind: "product",
      format: "reel_script",
      hook: "Watch HydroTrail plan a 22 km ridge walk in ten seconds.",
      caption: "Distance, climb, forecast high: litres to carry and where to refill. Early access is free.",
      shortCaption: "A 22 km ridge walk planned in ten seconds. Early access is free.",
      imageText: "22 km plan",
      hashtags: ["hikingapp"],
    },
    mon: {
      kind: "community",
      format: "poll",
      hook: "How do you decide how much water to carry?",
      caption: "Be honest. I'm building HydroTrail around the answers.",
      shortCaption: "Be honest. I'm building around the answers.",
      imageText: "Your rule?",
      pollOptions: ["A rule of thumb", "I fill everything", "An app", "I guess"],
      hashtags: ["hiking"],
    },
    tue: {
      kind: "story",
      format: "image",
      hook: "The day I turned back 3 km from the summit.",
      caption: "Not because of my legs: I'd drunk my water too early. That's why HydroTrail paces your sips.",
      shortCaption: "I drank my water too early and turned back 3 km short. HydroTrail paces your sips.",
      imageText: "3 km short",
      imageAlt: "Text card reading 3 km short",
      hashtags: ["hikingstories", "solohiking"],
    },
    wed: {
      kind: "offer",
      format: "image",
      hook: "The first 50 on the waitlist get early access, free.",
      caption: "Plan your next route with HydroTrail before anyone else. Link in bio.",
      shortCaption: "First 50 on the waitlist get free early access. Link in bio.",
      imageText: "First 50",
      imageAlt: "Text card reading First 50",
      hashtags: ["hiking", "earlyaccess"],
    },
    thu: {
      kind: "value",
      format: "carousel",
      hook: "Five places hikers forget to refill.",
      caption: "Mark them on your next plan. HydroTrail shows the distance to each source.",
      shortCaption: "Five refill spots to mark on your next plan.",
      imageText: "Refill here",
      imageAlt: "Carousel cover reading Refill here",
      hashtags: ["hikingtips"],
    },
  },
};

export const hydrotrailSeoPack: SeoPack = {
  schemaVersion: 1,
  pages: [
    {
      path: "/",
      title: "HydroTrail: know how much water to carry",
      metaDescription:
        "Plan litres to carry from distance, heat and climb, and get sip reminders on long solo hikes. Join the HydroTrail waitlist.",
    },
    {
      path: "/blog/how-much-water-to-carry-on-a-hike",
      title: "How much water to carry on a hike",
      metaDescription: "A practical guide to planning water for long, hot hikes: rates, refills and when the rules of thumb fail.",
    },
  ],
  keywordsTargeted: ["how much water to carry hiking", "hiking hydration planner", "water for a day hike"],
  article: {
    title: "How much water to carry on a hike",
    slug: "how-much-water-to-carry-on-a-hike",
    outline: [
      "Start from 500 ml an hour",
      "Adjust for heat",
      "Adjust for climb",
      "Plan refills between sources",
      "Sip on pace, not on thirst",
    ],
    bodyMarkdown:
      "# How much water to carry on a hike\n\nMost hikers start from about 500 ml an hour. That rule works on a cool, flat day.\n\n## Adjust for heat\n\nAbove 25°C, plan for more.\n\n## Adjust for climb\n\nSteady climbing raises what you need.\n\n## Plan refills\n\nKnow the distance to the next source before you set off. [Join the HydroTrail waitlist](/#waitlist) to plan it for you.",
  },
};

export const hydrotrailLaunchPlan: LaunchPlan = {
  schemaVersion: 1,
  items: [
    {
      key: "landing_live",
      day: "fri",
      order: 1,
      title: "Landing page live",
      detail: "hydrotrail.weekendmvp.app is live with the waitlist.",
      owner: { kind: "employee", roleKey: "landing" },
      link: { sitePath: "/" },
    },
    {
      key: "brand_kit_approved",
      day: "fri",
      order: 2,
      title: "Brand kit approved",
      detail: "Name, palette, type and voice are locked for every other employee.",
      owner: { kind: "employee", roleKey: "brand" },
      link: { artifactKind: "brand_kit" },
    },
    {
      key: "first_share",
      day: "fri",
      order: 3,
      title: "First share: waitlist live",
      detail: "Post the drafted message in two hiking communities you're already part of.",
      owner: { kind: "founder", draftedBy: "marketing" },
    },
    {
      key: "email_sequence_approved",
      day: "sat",
      order: 1,
      title: "Email sequence (4) approved",
      detail: "Welcome, value, offer and follow-up emails go out as people confirm.",
      owner: { kind: "employee", roleKey: "email" },
      link: { artifactKind: "email_sequence" },
    },
    {
      key: "social_posts_ready",
      day: "sat",
      order: 2,
      title: "7 social posts copy-ready",
      detail: "One post a day, Friday to Thursday.",
      owner: { kind: "employee", roleKey: "social" },
      link: { artifactKind: "social_pack" },
    },
    {
      key: "prompt_pack_downloaded",
      day: "sat",
      order: 3,
      title: "Product prompt pack downloaded",
      detail: "Eight prompts in four phases, ready for your coding tool.",
      owner: { kind: "founder", draftedBy: "engineering" },
      link: { workspace: "files" },
    },
    {
      key: "offer_images",
      day: "sun",
      order: 1,
      title: "3 offer images in Library",
      detail: "Early-access cards in the brand palette for posts and ads.",
      owner: { kind: "employee", roleKey: "brand" },
      link: { workspace: "library" },
    },
    {
      key: "ad_creative_ready",
      day: "sun",
      order: 2,
      title: "1 ad creative ready",
      detail: "A $7/day waitlist test, capped at $98, waiting for your ad account.",
      owner: { kind: "employee", roleKey: "ads" },
      link: { artifactKind: "ads_drafts" },
    },
  ],
};

export const hydrotrailAdsDrafts: AdsDrafts = {
  schemaVersion: 1,
  campaign: {
    name: "HydroTrail waitlist · Facebook + Instagram",
    platforms: ["facebook", "instagram"],
    objective: "waitlist_signups",
    audience: {
      description: "Interests: hiking, backpacking, trail running, national parks.",
      ageMin: 25,
      ageMax: 54,
      locationNote: "Within 200 km of [YOUR CITY]",
    },
    currency: "USD",
    dailyBudgetCents: 700,
    learningWindowDays: 14,
    lifetimeCapCents: 9800,
  },
  creatives: [
    {
      headline: "Know your water. Drink before you're thirsty.",
      primaryText: "HydroTrail plans the litres to carry from distance, heat and climb. Join the waitlist for free early access.",
      ctaLabel: "Join waitlist",
      imageAlt: "A solo hiker on a sunlit ridge with the HydroTrail sip reminder on screen",
    },
  ],
  decisionLog: [
    {
      decision: "$7/day for 14 days, capped at $98",
      why: "The smallest budget that can finish a 14-day learning window; the cap stops spend at $98.",
    },
    {
      decision: "Objective: waitlist signups",
      why: "Matches the first goal: 50 waitlist signups this weekend.",
    },
  ],
};

const prompt = (
  title: string,
  timeMinutes: number,
  body: string,
  doNotBuild: string,
  doneWhen: string,
): BuildPrompt => ({ title, timeMinutes, body, doNotBuild, doneWhen });

/** The Project Setup prompt (`scaffold.first`), written to pass the setup rules of prompt standard v1. */
const hydrotrailSetupBody = [
  "HydroTrail: a mobile web app that tells solo hikers how much water to carry and when to sip.",
  "Stack: Next.js, Supabase (Postgres and Supabase Auth with an email magic link), hosted on Vercel.",
  "One login path only: Supabase Auth magic link. Turn on row rules so each hiker sees only their own data.",
  "Tables:",
  "- routes(id, user_id, name, distance_km, climb_m, created_at): a planned route",
  "- plans(id, route_id, forecast_high_c, litres_to_carry, created_at): the water plan for one outing",
  "- drink_logs(id, plan_id, ml, logged_at): each drink the hiker logs",
  "Screens: Plan, On trail, Log",
  "Env vars (names only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "Add a web manifest so the app installs to the home screen.",
].join("\n");

export const hydrotrailBuildPack: BuildPack = {
  schemaVersion: 1,
  weight: "full",
  phases: {
    discovery: {
      blurb: "Write down the one user and the one loop before any code.",
      prompts: {
        first: prompt(
          "Write PRODUCT.md",
          15,
          "Read the brief below and write PRODUCT.md: the one user, the one loop, five features and what is out of scope.",
          "code, a database or a login screen.",
          "PRODUCT.md lists the user, the loop, five features and the scope cuts.",
        ),
        second: prompt(
          "Plan the screens",
          30,
          "From PRODUCT.md, list the three screens (Plan, On trail, Log) and the data each one reads and writes.",
          "a settings screen or an onboarding tour.",
          "A screen list with the data for each screen is in PRODUCT.md.",
        ),
      },
    },
    scaffold: {
      blurb: "One app, one login, the data model in place.",
      prompts: {
        first: prompt(
          "Project setup",
          45,
          hydrotrailSetupBody,
          "billing, social login, a second auth provider or an admin area.",
          "You can sign in by magic link on your phone, the three tables exist with row rules, and the app installs to the home screen.",
        ),
        second: prompt(
          "Build the three screens",
          45,
          "Build the Plan, On trail and Log screens with empty states, reading and writing the tables from setup.",
          "charts, sharing or a settings screen.",
          "A signed-in hiker can create a route and see it on the Plan screen after a reload.",
        ),
      },
    },
    core_loops: {
      blurb: "The planner and the reminder: the loop people came for.",
      prompts: {
        first: prompt(
          "Build the trail planner",
          120,
          "Turn distance, climb and forecast high into litres to carry and refill points. Fetch the forecast from Open-Meteo (no key).",
          "maps, GPS tracking or route import.",
          "Entering a 22 km route with 600 m climb at 30°C shows litres to carry.",
        ),
        second: prompt(
          "Build sip reminders and the log",
          90,
          "Schedule sip reminders paced to the plan and add a one-tap drink log.",
          "wearable integration or push to a second device.",
          "A reminder fires on pace and a tap logs 250 ml against the plan.",
        ),
      },
    },
    ship: {
      blurb: "Offline, polished and shared with the waitlist.",
      prompts: {
        first: prompt(
          "Make it work offline",
          60,
          "Cache the plan and the log so both work with no signal and sync when back online.",
          "a native app wrapper.",
          "With airplane mode on, the plan opens and a drink can be logged.",
        ),
        second: prompt(
          "Ship and invite the waitlist",
          45,
          "Deploy, check the core loop on a phone and write the invite for the first 50 on the waitlist.",
          "new features.",
          "The live URL works on a phone and the invite is ready to send.",
        ),
      },
    },
  },
  stack: [
    { label: "App", value: "Next.js (mobile web, installable)", outsideService: false },
    { label: "Database and login", value: "Supabase (Postgres, Supabase Auth magic link)", outsideService: true },
    { label: "Forecast", value: "Open-Meteo (no key)", outsideService: true },
    { label: "Hosting", value: "Vercel", outsideService: false },
  ],
  productMd:
    "# HydroTrail\n\nOne user: a solo day-hiker planning a long, hot route.\n\nOne loop: plan a route, carry the right litres, sip on pace, log drinks.\n\nOut of scope: GPS, wearables, social. See the [forecast source](https://open-meteo.com/).",
};

/** A light pack (course idea): setup prompts only, no product phases. Exempt from "no billing". */
export const lightBuildPack: BuildPack = {
  schemaVersion: 1,
  weight: "light",
  setupPrompts: [
    prompt(
      "Set up checkout and course hosting",
      45,
      "Connect your course host and a checkout link for the one-time price, then link both from the site.",
      "a custom course platform.",
      "A test buyer can pay and reach lesson one.",
    ),
  ],
  stack: [{ label: "Course host", value: "Your chosen course host", outsideService: true }],
};

/** One valid HydroTrail instance per artifact kind. */
export const hydrotrailArtifacts: ArtifactByKind = {
  blueprint: hydrotrailBlueprint,
  roster_plan: hydrotrailRosterPlan,
  brand_kit: hydrotrailBrandKit,
  landing_spec: hydrotrailLandingSpec,
  email_sequence: hydrotrailEmailSequence,
  social_pack: hydrotrailSocialPack,
  seo_pack: hydrotrailSeoPack,
  launch_plan: hydrotrailLaunchPlan,
  ads_drafts: hydrotrailAdsDrafts,
  build_pack: hydrotrailBuildPack,
};
