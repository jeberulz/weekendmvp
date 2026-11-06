/**
 * WP75-S4a: brand-kit checks.
 *
 * - contrast: every `BRAND_TEXT_PAIRS` pair reaches AA body text (4.5:1),
 *   through the existing `failingTextPairs`, plus a guard for a malformed
 *   hex (which would otherwise throw in the luminance maths);
 * - the type pair suits the visual direction (`TYPE_PAIRS[pair].directions`);
 * - the theme mode matches the palette (a light theme has a lighter ground).
 */
import {
  TYPE_PAIRS,
  failingTextPairs,
  hexColourSchema,
  relativeLuminance,
  type BrandKit,
} from "../../contracts/artifacts";
import { issue, type CheckIssue } from "./types";

const ROLES = ["primary", "secondary", "accent", "ground", "ink"] as const;

export function checkBrandContrast(kit: BrandKit): CheckIssue[] {
  const issues: CheckIssue[] = [];
  let allValid = true;
  for (const role of ROLES) {
    if (!hexColourSchema.safeParse(kit.palette[role].hex).success) {
      allValid = false;
      issues.push(issue("hard", "invalid_hex", ["palette", role, "hex"], `The ${role} colour is not a #RRGGBB hex.`));
    }
  }
  if (!allValid) return issues;
  for (const pair of failingTextPairs(kit)) {
    issues.push(
      issue(
        "hard",
        "low_contrast",
        ["palette", pair.text, "hex"],
        `${pair.text} text on ${pair.background} is ${pair.ratio.toFixed(2)}:1; WCAG AA needs 4.5:1. Darken or lighten the ${pair.text} colour.`,
      ),
    );
  }
  return issues;
}

export function checkTypePairDirection(kit: BrandKit): CheckIssue[] {
  const pair = TYPE_PAIRS[kit.type.pair];
  const { direction } = kit.visualSystem;
  if (pair.directions.includes(direction)) return [];
  return [
    issue("hard", "type_pair_direction", ["type", "pair"], `Type pair ${kit.type.pair} does not suit the ${direction} direction (${pair.directions.join(", ")}).`),
  ];
}

export function checkThemeMode(kit: BrandKit): CheckIssue[] {
  const { ground, ink } = kit.palette;
  if (!hexColourSchema.safeParse(ground.hex).success || !hexColourSchema.safeParse(ink.hex).success) return [];
  const groundIsLighter = relativeLuminance(ground.hex) > relativeLuminance(ink.hex);
  const { mode } = kit.visualSystem.theme;
  if (groundIsLighter === (mode === "light")) return [];
  return [
    issue(
      "hard",
      "theme_mode_mismatch",
      ["visualSystem", "theme", "mode"],
      mode === "light" ? "A light theme needs a ground lighter than its ink." : "A dark theme needs a ground darker than its ink.",
    ),
  ];
}

/** Every brand-kit check. */
export function checkBrandKit(kit: BrandKit): CheckIssue[] {
  return [...checkBrandContrast(kit), ...checkTypePairDirection(kit), ...checkThemeMode(kit)];
}
