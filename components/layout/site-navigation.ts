type NavLink = { label: string; href: string };
type DropdownColumn = { heading: string; links: NavLink[] };
type DropdownDef = {
  id: string;
  label: string;
  columns: DropdownColumn[];
  footerLink: NavLink;
  panelClassName: string;
  gridClassName: string;
};

/** Shared discovery destinations for the desktop dropdowns and mobile drawer. */
export const SITE_NAV_SECTIONS: DropdownDef[] = [
  {
    id: "browse-ideas",
    label: "Browse Ideas",
    panelClassName: "min-w-[480px]",
    gridClassName: "grid-cols-3",
    columns: [
      {
        heading: "By Category",
        links: [
          { label: "SaaS", href: "/ideas/saas" },
          { label: "AI Tools", href: "/ideas/ai-tools" },
          { label: "Productivity", href: "/ideas/productivity" },
          { label: "Automation", href: "/ideas/automation" },
          { label: "Developer Tools", href: "/ideas/developer-tools" },
        ],
      },
      {
        heading: "By Revenue",
        links: [
          { label: "$1K/month", href: "/ideas/1k-month" },
          { label: "$5K/month", href: "/ideas/5k-month" },
          { label: "Passive Income", href: "/ideas/passive-income" },
        ],
      },
      {
        heading: "By Time",
        links: [
          { label: "8 Hours", href: "/ideas/build-in-8-hours" },
          { label: "Weekend", href: "/ideas/build-in-weekend" },
          { label: "1 Week", href: "/ideas/build-in-1-week" },
        ],
      },
    ],
    footerLink: { label: "View All Ideas", href: "/startup-ideas" },
  },
  {
    id: "build-with",
    label: "Build With",
    panelClassName: "min-w-[400px]",
    gridClassName: "grid-cols-3",
    columns: [
      {
        heading: "AI Code Editors",
        links: [
          { label: "Cursor", href: "/build-with/cursor" },
          { label: "Windsurf", href: "/build-with/windsurf" },
          { label: "Claude", href: "/build-with/claude" },
          { label: "Claude Code", href: "/build-with/claude-code" },
        ],
      },
      {
        heading: "No-Code",
        links: [
          { label: "Bolt.new", href: "/build-with/bolt" },
          { label: "Lovable", href: "/build-with/lovable" },
        ],
      },
      {
        heading: "Other",
        links: [
          { label: "Replit", href: "/build-with/replit" },
          { label: "v0", href: "/build-with/v0" },
        ],
      },
    ],
    footerLink: { label: "All Tools", href: "/build-with/no-code" },
  },
  {
    id: "ideas-for",
    label: "Ideas For",
    panelClassName: "min-w-[320px]",
    gridClassName: "grid-cols-2",
    columns: [
      {
        heading: "By Skill Level",
        links: [
          { label: "Developers", href: "/ideas-for/developers" },
          { label: "Designers", href: "/ideas-for/designers" },
          { label: "Non-Technical", href: "/ideas-for/non-technical" },
        ],
      },
      {
        heading: "By Situation",
        links: [
          { label: "Solo Founders", href: "/ideas-for/solo-founders" },
          { label: "Side Hustlers", href: "/ideas-for/side-hustlers" },
          { label: "Weekend Builders", href: "/ideas-for/weekend-builders" },
        ],
      },
    ],
    footerLink: { label: "View All Ideas", href: "/startup-ideas" },
  },
];
