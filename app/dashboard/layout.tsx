import type { Metadata } from "next";
import { AuthPlatformProvider } from "../AuthPlatformProvider";
import { SignedInShell } from "@/components/platform/shell/SignedInShell";

export const metadata: Metadata = {
  title: "Weekend MVP",
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
      <SignedInShell>{children}</SignedInShell>
    </AuthPlatformProvider>
  );
}
