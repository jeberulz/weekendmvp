import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function EmailSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
