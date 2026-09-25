import type { Metadata } from "next";

import { OwnIdeaIntake } from "@/components/platform/intake/OwnIdeaIntake";

export const metadata: Metadata = {
  title: "New idea | Workspace",
  robots: { index: false, follow: false },
};

// The optional resume target and authenticated Convex state are runtime-only.
export const instant = false;

export default async function NewIdeaPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return (
    <section aria-label="Own idea intake" className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <OwnIdeaIntake projectId={project} />
    </section>
  );
}
