import type { StorageMode } from "@/keystatic.config";

type Setting = string | undefined;
type Credentials = readonly [clientId: Setting, clientSecret: Setting, encryptionSecret: Setting, publicSlug: Setting];

export function editorMode(production: boolean, credentials: Credentials): StorageMode | null {
  if (credentials.every((value) => value?.trim()) && (credentials[2]?.length ?? 0) >= 32) return "github";
  if (production || credentials.some((value) => value?.trim())) return null;
  return "local";
}

export function isPublicEditorOAuth(mode: StorageMode, method: string, url: URL) {
  return mode === "github" && method === "GET" && (
    url.pathname === "/api/keystatic/github/login" ||
    // The endpoint is reachable for protocol errors. Exchanging a code issues
    // a repository-write credential and requires the signed-in site operator.
    (url.pathname === "/api/keystatic/github/oauth/callback" && !url.searchParams.has("code"))
  );
}
