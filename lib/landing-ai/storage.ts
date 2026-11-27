import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { landingContentDirectory } from "@/keystatic.config";
import { type LandingPageId } from "./blocks";
import { contentBranch, digest } from "./draft";
import { withLocalEditorWrite } from "./write-lock";

export class DraftStorageError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}

type Snapshot = { document: unknown; revision: string; baseCommit?: string; exists?: boolean };
export type DraftStore = {
  read(page: LandingPageId): Promise<Snapshot>;
  save(page: LandingPageId, prior: Snapshot, document: unknown): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
};

const repository = "jeberulz/weekendmvp";
const refs = z.object({ object: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/) }) });
const file = z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), content: z.string(), encoding: z.literal("base64") });

function contentPath(page: LandingPageId) {
  return `${landingContentDirectory}/${page}/index.json`;
}

function serialise(document: unknown) {
  return JSON.stringify(document, null, 2) + "\n";
}

export function localDraftStore(root = process.cwd()): DraftStore {
  return {
    async read(page) {
      const raw = await readFile(join(root, contentPath(page)), "utf8");
      return { document: JSON.parse(raw), revision: digest(raw) };
    },
    async save(page, prior, document) {
      const target = join(root, contentPath(page));
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, serialise(document), { flag: "wx" });
        const current = await readFile(target, "utf8");
        if (digest(current) !== prior.revision) throw new DraftStorageError("The page changed. Generate a new preview.");
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
      }
    },
    transaction: withLocalEditorWrite,
  };
}

export function githubDraftStore(branchInput: string, token: string, fetcher = fetch): DraftStore {
  const branch = contentBranch.parse(branchInput);
  const base = `https://api.github.com/repos/${repository}`;
  const refPath = (name: string) => "/git/ref/heads/" + name.split("/").map(encodeURIComponent).join("/");
  function request(path: string, method = "GET", data?: object) {
    return fetcher(base + path, {
      method,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  }

  async function checked(response: Response) {
    if (response.status === 401 || response.status === 403) {
      throw new DraftStorageError("Reconnect GitHub in Keystatic to continue.", 403);
    }
    if (!response.ok) throw new DraftStorageError("GitHub could not read the selected content.", 502);
    return response.json();
  }

  return {
    async read(page) {
      const current = await request(refPath(branch));
      const exists = current.ok;
      const head = refs.parse(await checked(current.status === 404 ? await request(refPath("main")) : current));
      const commit = head.object.sha;
      const entry = file.parse(await checked(await request(`/contents/${contentPath(page)}?ref=${commit}`)));
      return { document: JSON.parse(Buffer.from(entry.content, "base64").toString("utf8")), revision: entry.sha, baseCommit: commit, exists };
    },
    async save(page, prior, document) {
      if (!prior.exists) {
        if (!prior.baseCommit) throw new DraftStorageError("The branch base could not be identified.");
        const created = await request("/git/refs", "POST", { ref: `refs/heads/${branch}`, sha: prior.baseCommit });
        if (created.status === 422) throw new DraftStorageError("The selected branch changed. Generate a new preview.");
        if (!created.ok) await checked(created);
      }
      const response = await request(`/contents/${contentPath(page)}`, "PUT", {
        branch,
        sha: prior.revision,
        message: `Edit landing copy for ${page}`,
        content: Buffer.from(serialise(document)).toString("base64"),
      });
      if (response.status === 409 || response.status === 422 || response.status === 404) {
        throw new DraftStorageError("The page or branch changed. Generate a new preview.");
      }
      if (!response.ok) await checked(response);
    },
    transaction: (work) => work(),
  };
}
