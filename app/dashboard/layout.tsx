import type { Metadata } from "next";
import { AuthPlatformProvider } from "../AuthPlatformProvider";
import { WorkspaceShell } from "@/components/platform/shell/WorkspaceShell";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      {/* The research-desk serif (WP42) for the brand mark and page titles. */}
      <div className={newsreaderEditorial.variable}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </div>
    </AuthPlatformProvider>
  );
}
