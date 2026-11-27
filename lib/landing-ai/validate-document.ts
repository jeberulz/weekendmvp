import type { ComponentSchema, FormFieldStoredValue } from "@keystatic/core";
import { z } from "zod";
import { landingEditorConfig } from "@/keystatic.config";
import { mapBuilderGuide } from "@/lib/landing/read-builder-guide";
import { validateStarter } from "@/lib/landing/read-starter";
import { mapStarterKit } from "@/lib/landing/read-starter-kit";
import { mapShipable } from "@/lib/landing/read-shipable";
import { mapDare } from "@/lib/landing/read-dare";
import { validateLiveHub } from "@/lib/landing/read-live-hub";
import { validateFreeWebinar } from "@/lib/landing/read-free-webinar";
import { validateBuildAlong } from "@/lib/landing/read-build-along";
import { validateHome } from "@/lib/landing/read-home";
import type { LandingPageId } from "./blocks";

const record = z.record(z.string(), z.unknown());

function parseObject(schema: Record<string, ComponentSchema>, raw: unknown) {
  const value = record.parse(raw);
  if (Object.keys(value).some((key) => !Object.hasOwn(schema, key))) throw new Error("Unexpected content field");
  return Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, parseField(field, value[key])]));
}

function parseField(field: ComponentSchema, raw: unknown): unknown {
  if (field.kind === "object") return parseObject(field.fields, raw ?? {});
  if (field.kind === "array") {
    const list = z.array(z.unknown()).parse(raw === undefined ? [] : raw);
    const limit = field.validation?.length;
    if (list.length < (limit?.min ?? 0) || list.length > (limit?.max ?? Infinity)) throw new Error("Invalid list size");
    return list.map((item) => parseField(field.element, item));
  }
  if (field.kind === "conditional") {
    const block = z.strictObject({ discriminant: z.string(), value: z.unknown() }).parse(raw);
    if (!Object.hasOwn(field.values, block.discriminant)) throw new Error("Unknown block type");
    return { discriminant: block.discriminant, value: parseField(field.values[block.discriminant], block.value) };
  }
  if (field.kind === "form" && field.formKind !== "content") return field.reader.parse(raw as FormFieldStoredValue);
  throw new Error("Unsupported content field");
}

export function validateLandingDocument(page: LandingPageId, raw: unknown) {
  const parsed = parseObject(landingEditorConfig("local").singletons[page].schema, raw);
  switch (page) {
    case "guide-5-to-9-builder": return mapBuilderGuide(parsed as Parameters<typeof mapBuilderGuide>[0]);
    case "starter-5-to-9": return validateStarter(parsed as Parameters<typeof validateStarter>[0]);
    case "starter-kit": return mapStarterKit(parsed as Parameters<typeof mapStarterKit>[0]);
    case "shipable": return mapShipable(parsed as Parameters<typeof mapShipable>[0]);
    case "dare": return mapDare(parsed as Parameters<typeof mapDare>[0]);
    case "live-hub": return validateLiveHub(parsed as Parameters<typeof validateLiveHub>[0]);
    case "live-48-hours": return validateFreeWebinar(parsed as Parameters<typeof validateFreeWebinar>[0]);
    case "live-build-along": return validateBuildAlong(parsed as Parameters<typeof validateBuildAlong>[0]);
    case "home": return validateHome(parsed as Parameters<typeof validateHome>[0]);
  }
}
