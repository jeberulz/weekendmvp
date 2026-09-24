import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
