import { AuthPlatformProvider } from "../AuthPlatformProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthPlatformProvider>{children}</AuthPlatformProvider>;
}
