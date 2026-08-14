import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
