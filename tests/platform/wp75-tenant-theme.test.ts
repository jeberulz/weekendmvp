import { describe, expect, test, vi } from "vitest";

import googleFontData from "next/dist/compiled/@next/font/dist/google/font-data.json";

import { fontMockModule, kitFor } from "./tenant-site-helpers";

const calls = vi.hoisted(() => [] as { family: string; options: Record<string, unknown> }[]);
vi.mock("next/font/google", async () => (await import("./tenant-site-helpers")).fontMockModule(calls));

import { TENANT_FONTS } from "@/components/tenant-site/fonts";
import { tenantStyle } from "@/components/tenant-site/styles";
import { MIN_NON_TEXT_CONTRAST, deriveTheme, mixHex, safeHex } from "@/components/tenant-site/theme";
import { ART_DIRECTIONS, MIN_TEXT_CONTRAST, TYPE_PAIRS, TYPE_PAIR_IDS, contrastRatio } from "@/lib/workspace/contracts/artifacts";

void fontMockModule;
const ratio = (a: string, b: string) => contrastRatio(a, b);

describe("HydroTrail kit", () => {
  const theme = deriveTheme(kitFor("warm_utility"));
  test("every text pair passes AA and none fell back", () => {
    for (const pair of Object.values(theme.pairs)) {
      expect(pair.fellBack).toBe(false);
      expect(ratio(pair.text, pair.background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    expect(theme.degraded).toBe(false);
  });
  test("accent is never a text colour", () => {
    const text = [theme.vars["--t-ink"], theme.vars["--t-link"], theme.vars["--t-btn-text"], theme.vars["--t-dark-text"], theme.vars["--t-sel-text"]];
    expect(text).not.toContain(theme.vars["--t-accent"]);
  });
  test("surface, focus ring and control borders meet the thresholds", () => {
    expect(ratio(theme.vars["--t-ink"], theme.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(ratio(theme.vars["--t-link"], theme.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    for (const zone of [theme.vars["--t-ground"], theme.surface]) {
      expect(ratio(theme.focus, zone)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      expect(ratio(theme.control, zone)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    }
    expect(ratio(theme.focusInverse, theme.vars["--t-dark"])).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    expect(ratio(theme.vars["--t-control-inverse"], theme.vars["--t-dark"])).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    expect(ratio(theme.vars["--t-btn-border"], theme.vars["--t-ground"])).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
  });
});

describe("a forced low-contrast kit", () => {
  // Primary #A9C4CE on ground #F2EEE6 is about 1.6:1: both primary-based pairs fail and show ink on ground.
  const kit = kitFor("warm_utility", { primary: "#a9c4ce" });
  const theme = deriveTheme(kit);
  test("link and button pairs fall back to ink on ground", () => {
    expect(theme.pairs.link).toMatchObject({ fellBack: true, text: kit.palette.ink.hex.toLowerCase(), background: kit.palette.ground.hex.toLowerCase() });
    expect(theme.pairs.button).toMatchObject({ fellBack: true, text: kit.palette.ink.hex.toLowerCase() });
    expect(theme.vars["--t-link"]).toBe(theme.vars["--t-ink"]);
    expect(theme.pairs.inverse.fellBack).toBe(false);
  });
  test("a fallen-back button still has a 3:1 border and a visible selection", () => {
    expect(ratio(theme.vars["--t-btn-border"], theme.vars["--t-ground"])).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    expect(theme.vars["--t-sel-bg"]).not.toBe(theme.vars["--t-ground"]);
  });
  test("review repro: ground #f2eee6, ink #111111, primary #a9c4ce keeps a 3:1 button border", () => {
    const repro = deriveTheme(kitFor("warm_utility", { ground: "#f2eee6", ink: "#111111", primary: "#a9c4ce" }));
    expect(repro.pairs.button.fellBack).toBe(true);
    for (const zone of [repro.vars["--t-ground"], repro.surface]) {
      expect(ratio(repro.vars["--t-btn-border"], zone)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    }
  });
  test("an ink that fails on ground falls back to black or white and flags the kit", () => {
    const worst = deriveTheme(kitFor("quiet_technical", { ink: "#e6e1d8", ground: "#f2eee6" }));
    expect(worst.degraded).toBe(true);
    expect(["#000000", "#ffffff"]).toContain(worst.vars["--t-ink"]);
    expect(ratio(worst.vars["--t-ink"], worst.vars["--t-ground"])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});

describe("random kits (seeded)", () => {
  let seed = 7;
  const next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const colour = () => `#${Math.floor(next() * 0xffffff).toString(16).padStart(6, "0")}`;
  test("every text pair is AA, and rings and controls are 3:1, for 400 kits, including borders, icons and inverse colours", () => {
    for (let i = 0; i < 400; i += 1) {
      const direction = ART_DIRECTIONS[i % ART_DIRECTIONS.length];
      const kit = kitFor(direction, { primary: colour(), secondary: colour(), accent: colour(), ground: colour(), ink: colour() });
      const theme = deriveTheme(kit);
      for (const pair of Object.values(theme.pairs)) expect(ratio(pair.text, pair.background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      for (const zone of [theme.vars["--t-ground"], theme.surface]) {
        expect(ratio(theme.focus, zone)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        expect(ratio(theme.control, zone)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
      expect(ratio(theme.vars["--t-ink"], theme.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(ratio(theme.vars["--t-link"], theme.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      const dark = theme.vars["--t-dark"];
      for (const zone of [theme.vars["--t-ground"], theme.surface]) {
        expect(ratio(theme.vars["--t-btn-border"], zone), "btn-border").toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        expect(ratio(theme.vars["--t-icon"], zone), "icon").toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
      expect(ratio(theme.vars["--t-icon-inverse"], dark), "icon-inverse").toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      expect(ratio(theme.vars["--t-focus-inverse"], dark), "focus-inverse").toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      expect(ratio(theme.vars["--t-control-inverse"], dark), "control-inverse").toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      expect(() => tenantStyle(theme, TENANT_FONTS[kit.type.pair], 700, true)).not.toThrow();
    }
  });
});

describe("helpers", () => {
  test("safeHex only passes #RRGGBB", () => {
    expect(safeHex("#ABCDEF", "#000000")).toBe("#abcdef");
    for (const bad of ["red", "#fff", "#12345g", "#ffffff;}", "#ffffff</style>", 5, null]) expect(safeHex(bad, "#000000")).toBe("#000000");
  });
  test("mixHex endpoints", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});

describe("type pairs: one loader per family, weights and variables match TYPE_PAIRS", () => {
  const byFamily = new Map(calls.map((call) => [call.family, call.options]));
  test("every family of every pair has a loader with preload off and the pair's weights", () => {
    const needed = new Map<string, Set<string>>();
    for (const id of TYPE_PAIR_IDS) {
      const { heading, body, mono } = TYPE_PAIRS[id];
      for (const face of [heading, body, mono]) {
        if (!face) continue;
        const set = needed.get(face.family) ?? new Set<string>();
        face.weights.forEach((weight) => set.add(String(weight)));
        needed.set(face.family, set);
      }
    }
    for (const [family, weights] of needed) {
      const options = byFamily.get(family);
      expect(options, family).toBeDefined();
      expect(options?.preload).toBe(false);
      expect(options?.subsets).toEqual(["latin"]);
      const wght = (googleFontData as Record<string, { axes?: { tag: string; min: number; max: number }[] }>)[family]?.axes?.find(
        (axis) => axis.tag === "wght",
      );
      if (wght) {
        // A variable family loads as one variable file: named weights of a variable font make Google build
        // instances on demand behind `/l/font?kit=…&…` URLs that break the Turbopack build at random.
        expect(options?.weight, family).toBe("variable");
        for (const weight of weights) {
          expect(Number(weight), `${family} ${weight}`).toBeGreaterThanOrEqual(wght.min);
          expect(Number(weight), `${family} ${weight}`).toBeLessThanOrEqual(wght.max);
        }
      } else {
        expect([...(options?.weight as string[])].sort(), family).toEqual([...weights].sort());
      }
    }
    expect(byFamily.size).toBe(needed.size);
  });
  test("each pair's stacks use the variable its loader declared, and classes are only its own", () => {
    const declared = new Set(calls.map((call) => String(call.options.variable)));
    for (const id of TYPE_PAIR_IDS) {
      const pair = TENANT_FONTS[id];
      for (const stack of [pair.heading, pair.body, pair.mono]) {
        const variable = /^var\((--tsr-[a-z-]+)\)/.exec(stack)?.[1];
        if (variable) expect(declared.has(variable), `${id} ${variable}`).toBe(true);
      }
      expect(pair.classNames.split(" ").length).toBeLessThanOrEqual(3);
    }
    expect(new Set(TYPE_PAIR_IDS.map((id) => TENANT_FONTS[id].classNames)).size).toBe(TYPE_PAIR_IDS.length);
  });
});

describe("tenantStyle refuses forged input", () => {
  const theme = deriveTheme(kitFor("warm_utility"));
  const fonts = TENANT_FONTS.bricolage_grotesque_figtree;
  test("a good theme passes", () => {
    expect(tenantStyle(theme, fonts, 700, true).css).toContain("html:has(");
  });
  test.each([
    ["a var value", { ...theme, vars: { ...theme.vars, "--t-ink": "#fff;}</style>" } }],
    ["a var value with url()", { ...theme, vars: { ...theme.vars, "--t-ink": "url(http:evil.example)" } }],
    ["a var name", { ...theme, vars: { ...theme.vars, "x;}": "#ffffff" } }],
    ["a mode", { ...theme, mode: "dark;background:url(http:evil.example)" as "dark" }],
  ])("throws on %s", (_label, forged) => {
    expect(() => tenantStyle(forged, fonts, 700, true)).toThrow();
  });
  test.each([0, 1000, 700.5, Number.NaN])("throws on heading weight %s", (weight) => {
    expect(() => tenantStyle(theme, fonts, weight, false)).toThrow();
  });
  test("throws on a forged font stack", () => {
    expect(() => tenantStyle(theme, { ...fonts, heading: "Evil;}" }, 700, false)).toThrow();
  });
});
