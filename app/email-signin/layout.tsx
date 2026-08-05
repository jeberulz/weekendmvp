import { AuthPlatformProvider } from "../AuthPlatformProvider";

export const instant = false;

export default function EmailSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
