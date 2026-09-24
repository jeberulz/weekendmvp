import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
