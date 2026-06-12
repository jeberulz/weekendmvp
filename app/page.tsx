// Placeholder until U6 ports the landing page. The fallback rewrite cannot
// proxy `/` because this file owns the route, so keep this page out of
// production traffic until U6 lands (deploy gating happens at the Vercel
// project level — next.weekendmvp.app is not user-facing during slicing).
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="logo h-6 w-44 text-white" role="img" aria-label="Weekend MVP" />
    </main>
  );
}
