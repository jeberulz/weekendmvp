import "server-only";

import { cookies } from "next/headers";
import type { StorageMode } from "@/keystatic.config";
import { contentBranch } from "./draft";
import { DraftStorageError, githubDraftStore, localDraftStore } from "./storage";

export async function editorStore(mode: StorageMode, branch?: string) {
  if (mode === "local") {
    if (branch) throw new DraftStorageError("Local previews use the local content file.", 400);
    return localDraftStore();
  }
  const parsed = contentBranch.safeParse(branch);
  if (!parsed.success) throw new DraftStorageError("Enter a branch beginning with content/.", 400);
  const token = (await cookies()).get("keystatic-gh-access-token")?.value;
  if (!token) throw new DraftStorageError("Connect GitHub in Keystatic to use a content branch.", 403);
  return githubDraftStore(parsed.data, token);
}
