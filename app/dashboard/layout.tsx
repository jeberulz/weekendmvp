import type { Metadata } from "next";
import { AuthPlatformProvider } from "../AuthPlatformProvider";
import { WorkspaceShell } from "@/components/platform/shell/WorkspaceShell";

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
    <AuthPlatformProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </AuthPlatformProvider>
  );
}
