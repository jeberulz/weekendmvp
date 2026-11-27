import { z } from "zod";
import type { StorageMode } from "@/keystatic.config";
import { beforeCopy, generateInput, landingBlocks, type Block, type Copy, type JsonPath } from "./blocks";
import { copyDigest, openProposal } from "./draft";
import { validateProposal } from "./guard";
import { isSameOrigin, privateJson, privateNotFound } from "./http";
import { DraftStorageError, type DraftStore } from "./storage";
import { validateLandingDocument } from "./validate-document";

const approvalInput = generateInput.omit({ instruction: true }).extend({
  after: z.unknown(),
  approval: z.string().min(1).max(4096),
});

type Destination = { mode: StorageMode; open(branch?: string): Promise<DraftStore> };

function writeAt(document: unknown, path: JsonPath, text: string) {
  let target = document;
  for (const key of path.slice(0, -1)) {
    if (!target || typeof target !== "object" || !Object.hasOwn(target, key)) throw new Error("Unknown copy field");
    target = (target as Record<string | number, unknown>)[key];
  }
  const last = path[path.length - 1];
  if (!target || typeof target !== "object" || !Object.hasOwn(target, last)) throw new Error("Unknown copy field");
  (target as Record<string | number, unknown>)[last] = text;
}

function applyToDocument(document: unknown, block: Block, after: Copy) {
  const next = structuredClone(z.record(z.string(), z.unknown()).parse(document));
  if (block.kind === "add") {
    const sections = z.array(z.unknown()).parse(next.additionalSections ?? []);
    next.additionalSections = [...sections, { discriminant: block.type, value: after }];
  } else {
    for (const field of block.fields) {
      const value = after[field.id];
      if (typeof value !== "string") throw new Error("Invalid text change");
      writeAt(next, field.path, value);
    }
  }
  return next;
}

export async function handleApprove(
  request: Request,
  dependencies: { authorised: () => Promise<boolean>; destination: Destination | null },
) {
  if (!dependencies.destination || !(await dependencies.authorised())) return privateNotFound();
  if (!isSameOrigin(request)) return privateJson({ error: "Use the signed-in page editor to approve a preview." }, 403);
  const parsed = approvalInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: "Select a valid preview to approve." }, 400);
  const input = parsed.data;
  const { mode, open } = dependencies.destination;
  try {
    const signed = openProposal(mode, input.approval, input);
    if (!signed) return privateJson({ error: "This approval expired or does not match the preview. Generate a new preview." }, 409);
    const store = await open(input.branch);
    return await store.transaction(async () => {
      const current = await store.read(input.page);
      if (current.revision !== signed.revision) throw new DraftStorageError("The page changed. Generate a new preview.");
      const block = landingBlocks(input.page, current.document).find(({ id }) => id === input.blockId);
      if (!block || (input.action === "add") !== (block.kind === "add") || copyDigest(beforeCopy(block)) !== signed.beforeDigest) {
        throw new DraftStorageError("The selected section changed. Generate a new preview.");
      }

      let next;
      try {
        const after = validateProposal(block, input.after);
        if (copyDigest(after) !== signed.digest) return privateJson({ error: "The approved wording must match the preview." }, 422);
        if (signed.beforeDigest === signed.digest) return privateJson({ error: "The preview has no changes to save." }, 422);
        next = applyToDocument(current.document, block, after);
        validateLandingDocument(input.page, next);
      } catch {
        return privateJson({ error: "The proposal does not meet the page's editing rules." }, 422);
      }
      await store.save(input.page, current, next);
      const href = mode === "github"
        ? `/admin/pages/branch/${encodeURIComponent(input.branch!)}/singleton/${input.page}`
        : `/admin/pages/singleton/${input.page}`;
      return privateJson({ saved: true, href, branch: input.branch ?? null });
    });
  } catch (error) {
    if (error instanceof DraftStorageError) return privateJson({ error: error.message }, error.status);
    return privateJson({ error: "The page could not be saved. Generate a fresh preview and retry." }, 502);
  }
}
