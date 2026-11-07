/**
 * WP67-S7 (issue #220). One shared avatar per named AI employee.
 *
 * The crew is fixed: 13 roles, one default name each (`convex/crew/roles.ts`).
 * Avatars are a one-time shared asset set keyed by role, generated with
 * Recraft V4.1 Flash by `scripts/generate-crew-avatars.mjs`, so no founder or
 * page view ever triggers a paid call. A founder who renames the lead keeps
 * the lead's avatar: the picture belongs to the role, the name to the founder.
 *
 * Flash takes no style id, so consistency comes from one shared style prompt
 * (`CREW_AVATAR_STYLE`) plus a short per-person description.
 *
 * `CREW_AVATAR_SRC` lists only assets that exist under `public/`. While a role
 * has no entry, `EmployeeAvatar` keeps its initial on the role colour.
 */

import type { RoleKey } from "./contracts/roster";

/** Bump when the style or a persona changes; the generator writes it into the asset manifest. */
export const CREW_AVATAR_STYLE_VERSION = "crew-avatars-v1";

/** Shared by every prompt. Tuned for a circular crop shown at 20–40 px and up to 160 px. */
export const CREW_AVATAR_STYLE =
  "Flat editorial illustration avatar, head and shoulders, facing the viewer, centred with generous margin so it survives a circular crop. " +
  "Bold simple shapes, clean confident outlines, subtle paper grain, no gradients. " +
  "Limited palette: warm near-black ink #1a1814, cream #f7f3ec and #fffdf9, skin and hair in natural tones, plus the one accent colour given below. " +
  "Solid flat background in the accent colour. Friendly, calm, quietly confident expression. " +
  "Clearly an illustration, not a photograph. No text, no letters, no logos, no frame, no watermark.";

export type CrewPersona = {
  readonly roleKey: RoleKey;
  readonly employeeName: string;
  /** Background accent, a `home-*` token value. */
  readonly accent: string;
  readonly accentName: string;
  /** Who they are, in a few visual traits: hair, clothing, one prop. */
  readonly look: string;
};

/** Names match `CREW_ROLES` in `convex/crew/roles.ts` (tests hold them in step). */
export const CREW_PERSONAS: readonly CrewPersona[] = Object.freeze([
  {
    roleKey: "lead",
    employeeName: "Wren",
    accent: "#cc5500",
    accentName: "burnt orange",
    look: "short cropped grey-streaked hair, round tortoiseshell glasses, dark crew-neck sweater over a white collar, holding a small notebook",
  },
  {
    roleKey: "brand",
    employeeName: "Iris",
    accent: "#a84a00",
    accentName: "deep orange",
    look: "voluminous dark curly hair tied up with a cream scarf, mustard turtleneck, a pencil tucked behind one ear",
  },
  {
    roleKey: "landing",
    employeeName: "Leo",
    accent: "#2c4a68",
    accentName: "slate blue",
    look: "tidy short beard, swept-back hair, denim overshirt over a cream tee, a small wireframe sketch card in his breast pocket",
  },
  {
    roleKey: "seo",
    employeeName: "Sana",
    accent: "#3a5530",
    accentName: "forest green",
    look: "sleek long black hair in a low ponytail, olive utility jacket, thin gold-rimmed glasses, a magnifying glass pendant",
  },
  {
    roleKey: "marketing",
    employeeName: "Marco",
    accent: "#6e5010",
    accentName: "ochre brown",
    look: "wavy shoulder-length hair, warm smile, rust corduroy blazer over a striped shirt, a megaphone pin on the lapel",
  },
  {
    roleKey: "email",
    employeeName: "Elle",
    accent: "#83382a",
    accentName: "clay red",
    look: "short blunt bob with a fringe, cream cardigan with a peter-pan collar, a folded paper envelope clip in her hair",
  },
  {
    roleKey: "social",
    employeeName: "Theo",
    accent: "#3d3570",
    accentName: "indigo",
    look: "tousled curly hair, small hoop earring, oversized graphic-free sage hoodie, wireless earbuds",
  },
  {
    roleKey: "engineering",
    employeeName: "Kai",
    accent: "#24211c",
    accentName: "charcoal",
    look: "buzz cut, angular face, black zip-up jacket over a cream tee, over-ear headphones resting around the neck",
  },
  {
    roleKey: "ads",
    employeeName: "Ada",
    accent: "#4a453c",
    accentName: "warm grey",
    look: "high top-knot bun, bold geometric earrings, cream blazer with rolled sleeves, confident half smile",
  },
  {
    roleKey: "curriculum",
    employeeName: "Cora",
    accent: "#2c4a68",
    accentName: "slate blue",
    look: "silver pixie cut, half-moon reading glasses, knitted ochre vest over a cream shirt, a stack of small index cards",
  },
  {
    roleKey: "community",
    employeeName: "Nia",
    accent: "#3a5530",
    accentName: "forest green",
    look: "long braids gathered over one shoulder, wide warm smile, terracotta knit sweater, a small speech-bubble brooch",
  },
  {
    roleKey: "merch",
    employeeName: "Max",
    accent: "#6e5010",
    accentName: "ochre brown",
    look: "beanie over short hair, light stubble, canvas work apron over a cream tee, a folded tote bag over one shoulder",
  },
  {
    roleKey: "outbound",
    employeeName: "Oli",
    accent: "#83382a",
    accentName: "clay red",
    look: "neat side-parted hair, freckles, navy knit polo, a small paper-plane pin on the collar",
  },
]);

export function crewAvatarSlug(persona: Pick<CrewPersona, "roleKey" | "employeeName">): string {
  return `${persona.roleKey}-${persona.employeeName.toLowerCase()}`;
}

/** Public path for a role's avatar once it exists. */
export function crewAvatarPublicPath(persona: Pick<CrewPersona, "roleKey" | "employeeName">): string {
  return `/image/crew/${crewAvatarSlug(persona)}.png`;
}

export function crewAvatarPrompt(persona: CrewPersona): string {
  return `${CREW_AVATAR_STYLE} Accent colour: ${persona.accentName} ${persona.accent}. Person: ${persona.look}.`;
}

/**
 * Roles whose avatar has been generated, approved and committed under
 * `public/image/crew/`. Empty until the owner approves the live run; the UI
 * shows initials for every role not listed here.
 */
export const CREW_AVATAR_SRC: Readonly<Partial<Record<RoleKey, string>>> = Object.freeze({});
