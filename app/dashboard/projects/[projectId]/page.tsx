import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { objectHomeHref } from "@/lib/signed-in-chrome";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(objectHomeHref(projectId));
}
