import type { ComponentSchema } from "@keystatic/core";
import { z } from "zod";
import { landingEditorConfig } from "@/keystatic.config";
import { lockedLines } from "./voice";

const pages = [
  "guide-5-to-9-builder", "starter-5-to-9", "starter-kit", "shipable", "dare",
  "live-hub", "live-48-hours", "live-build-along", "home",
] as const;

export const pageIdSchema = z.enum(pages);
export type LandingPageId = z.infer<typeof pageIdSchema>;
export const actionSchema = z.enum(["rewrite", "freshen", "shorten", "add"]);
export const generateInput = z.strictObject({
  page: pageIdSchema,
  blockId: z.string().min(1).max(120),
  action: actionSchema,
  instruction: z.string().trim().max(1500).optional(),
  branch: z.string().max(120).optional(),
});
export type GenerateInput = z.infer<typeof generateInput>;

const object = z.record(z.string(), z.unknown());
const storedBlock = z.object({ discriminant: z.string(), value: z.unknown() });
const modelText = z.string().min(1).max(6000).regex(/\S/);
const added = {
  editorialNote: z.strictObject({ title: modelText, body: modelText }),
  checklist: z.strictObject({ title: modelText, items: z.array(modelText).min(1) }),
};
type AddedBlockKind = keyof typeof added;
export type Copy = Record<string, string | string[]>;
export type JsonPath = readonly (number | string)[];

export type CopyField = { id: string; label: string; path: JsonPath; text: string };
export type ExistingBlock = { id: string; label: string; kind: "edit"; fields: CopyField[] };
export type NewBlock = { id: string; label: string; kind: "add"; type: AddedBlockKind };
export type Block = ExistingBlock | NewBlock;

const excluded = /^(?:id|slug|url|href|path|image|icon|automationId|followLabel|prompt|proof|proofQuotes|guarantee|cancellation|finePrint)$/i;
const settings = landingEditorConfig("local").singletons;

export function landingPageOptions() {
  return pages.map((id) => ({ id, label: settings[id].label }));
}

function readable(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
}

function fieldLabel(schema: ComponentSchema, key: string) {
  return "label" in schema && schema.label ? schema.label : readable(key);
}

function gather(schema: ComponentSchema, raw: unknown, path: JsonPath, labels: string[] = []): CopyField[] {
  if (schema.kind === "form" && typeof raw === "string" && raw.trim().length > 0) {
    if ((schema.formKind !== undefined && schema.formKind !== "slug") || typeof schema.defaultValue() !== "string") return [];
    if (lockedLines.some((line) => raw.includes(line))) return [];
    return [{ id: path.join("."), label: labels.join(" › "), text: raw, path }];
  }
  if (schema.kind === "object") {
    const value = object.safeParse(raw);
    if (!value.success) return [];
    return Object.entries(schema.fields).flatMap(([key, field]) => excluded.test(key)
      ? []
      : gather(field, value.data[key], [...path, key], [...labels, fieldLabel(field, key)]));
  }
  if (schema.kind === "array" && Array.isArray(raw)) {
    return raw.flatMap((value, index) => gather(schema.element, value, [...path, index], [...labels, String(index + 1)]));
  }
  if (schema.kind === "conditional") {
    const value = storedBlock.safeParse(raw);
    if (!value.success || !Object.hasOwn(schema.values, value.data.discriminant) || excluded.test(value.data.discriminant)) return [];
    return gather(schema.values[value.data.discriminant], value.data.value, [...path, "value"], labels);
  }
  return [];
}

export function landingBlocks(page: LandingPageId, raw: unknown): Block[] {
  const document = object.parse(raw);
  const fields: Record<string, ComponentSchema> = settings[page].schema;
  const result: Block[] = [];

  for (const [key, schema] of Object.entries(fields)) {
    if (excluded.test(key)) continue;
    const value = document[key];
    if (schema.kind === "array" && schema.element.kind === "conditional" && Array.isArray(value)) {
      const variants = schema.element.values;
      const seen = new Map<string, number>();
      value.forEach((item, index) => {
        const block = storedBlock.safeParse(item);
        if (!block.success || !Object.hasOwn(variants, block.data.discriminant) || excluded.test(block.data.discriminant)) return;
        const name = block.data.discriminant;
        const count = (seen.get(name) ?? 0) + 1;
        seen.set(name, count);
        const variant = variants[name];
        const label = fieldLabel(variant, name);
        const copy = gather(variant, block.data.value, [key, index, "value"]);
        if (copy.length) result.push({
          id: `${key}:${name}:${count}`, label: count === 1 ? label : `${label} ${count}`, kind: "edit", fields: copy,
        });
      });
    } else if (schema.kind === "object") {
      const copy = gather(schema, value, [key]);
      if (copy.length) result.push({ id: key, label: schema.label || readable(key), kind: "edit", fields: copy });
    }
  }
  if (page === "home") result.push(
    { id: "add:editorialNote", label: "New editorial note", kind: "add", type: "editorialNote" },
    { id: "add:checklist", label: "New checklist", kind: "add", type: "checklist" },
  );
  return result;
}

export function beforeCopy(block: Block): Copy {
  return block.kind === "edit" ? Object.fromEntries(block.fields.map(({ id, text }) => [id, text])) : {};
}

export function proposalSchema(block: Block) {
  if (block.kind === "add") return added[block.type];
  return z.strictObject(Object.fromEntries(block.fields.map(({ id }) => [id, modelText])));
}
