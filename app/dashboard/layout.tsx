import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthPlatformProvider } from "../AuthPlatformProvider";
import { WorkspaceShell } from "@/components/platform/shell/WorkspaceShell";
import { getDashboardEditorial } from "@/lib/dashboard/editorial";
import { newsreaderEditorial } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  // The dashboard and homepage now use the same request-time visibility gate.
  const editorial = await getDashboardEditorial();

  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      {/* The research-desk serif (WP42) for the brand mark and page titles. */}
      <div className={newsreaderEditorial.variable}>
        <WorkspaceShell ideaCount={editorial?.total ?? null}>{children}</WorkspaceShell>
      </div>
    </AuthPlatformProvider>
  );
}
