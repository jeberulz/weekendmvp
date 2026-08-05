import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
