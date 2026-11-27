"use client";

import { makePage } from "@keystatic/next/ui/app";
import { landingEditorConfig, type StorageMode } from "@/keystatic.config";

const LocalEditor = makePage(landingEditorConfig("local"));
const GitHubEditor = makePage(landingEditorConfig("github"));

export function LandingEditor({ mode }: { mode: StorageMode }) {
  return mode === "local" ? <LocalEditor /> : <GitHubEditor />;
}
