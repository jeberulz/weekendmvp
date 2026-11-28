import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

export const metadata = { title: { absolute: "Member activity — Weekend MVP Admin" } };
export const instant = false;
type Params = Promise<{ cursor?: string }>;
const when = (ms: number) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
}).format(ms);
function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function loadMembers(params: Params) {
  await connection();
  const token = await convexAuthNextjsToken();
  if (!token) notFound();
  const { cursor } = await params;
  const [members, week, totals] = await Promise.all([
    fetchQuery(api.admin.members.directory, { cursor: cursor ?? null }, { token }),
    fetchQuery(api.admin.members.week, { since: Date.now() - 7 * 86_400_000 }, { token }),
    fetchQuery(api.admin.members.totals, {}, { token }),
  ]).catch(() => notFound());

  return { members, week, totals, cursor };
}

function Metric({ label, count, limited }: { label: string; count: number; limited: boolean }) {
  return <div className="rounded-lg border border-home-rule bg-home-card p-5">
    <p className="text-sm">{label}</p>
    <strong className="text-3xl tabular-nums">{count}{limited ? "+" : ""}</strong>
  </div>;
}

async function Directory({ params }: { params: Params }) {
  const { members, week, totals, cursor } = await loadMembers(params);
  return <main className="min-h-screen bg-home-paper px-5 py-10 text-home-ink sm:px-10">
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-4xl">Member activity</h1>
      <div className="my-7 grid gap-4 sm:grid-cols-3">
        <Metric label="Total members" count={totals.total} limited={totals.totalLimited} />
        <Metric label="Signups in the last 7 days" count={week.signups} limited={week.signupsLimited} />
        <Metric label="Members with measured visits in the last 7 days" count={week.active} limited={week.activeLimited} />
      </div>
      <h2 className="font-serif text-2xl">Member directory</h2>
      <p className="mt-1 mb-5 text-sm text-home-ink-2">Newest accounts first. Expand a member for visits and product actions. Times are UTC.</p>
      {members.page.map(m => <details key={m.id} className="mb-2 rounded-lg border border-home-rule bg-home-card p-4">
        <summary className="cursor-pointer break-words">
          <strong>{m.email ?? m.name ?? "Email unavailable"}</strong>
          <span className="ml-3 text-sm text-home-ink-2">Joined {when(m.joined)} · {m.providers.map(p => p === "google" ? "Google" : p === "email" ? "Email link" : p).join(", ") || "Provider unavailable"}</span>
          <span className="mt-1 block text-sm text-home-ink-2">{m.lastSeen
            ? `Last visit ${when(m.lastSeen)} · ${m.views} visits · ${duration(m.focusedMs)} focused`
            : "No measured visits yet"}</span>
        </summary>
        <div className="mt-4 border-t border-home-rule pt-4 text-sm">
          {m.name && <p className="font-semibold">{m.name}</p>}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <section><h3 className="font-semibold">Recent page visits</h3>
              {m.recent.length ? <ul>{m.recent.map((v, i) => <li key={i} className="mt-2 break-words">{v.page} · {duration(v.focusedMs)}<br/><small>{when(v.started)}</small></li>)}</ul>
                : <p>No measured visits yet.</p>}
            </section>
            <section><h3 className="font-semibold">Recent product actions</h3>
              {m.events.length ? <ul>{m.events.map((e, i) => <li key={i} className="mt-2">{e.action} · {e.actorType}<br/><small>{when(e.createdAt)}</small></li>)}</ul>
                : <p>No recorded actions yet.</p>}
            </section>
          </div>
        </div>
      </details>)}
      {!members.page.length && <p>No member accounts on this page.</p>}
      <div className="my-4 flex gap-5 text-sm underline">{cursor && <a href="/admin">Newest members</a>}
        {members.next && <a href={`/admin?cursor=${encodeURIComponent(members.next)}`}>Older members →</a>}</div>
      <p className="text-sm text-home-ink-2">Page activity begins when measurement is enabled and a signed-in member accepts analytics. Focused time estimates how long the product tab was visible and focused. Each account shows its latest 20 visits and eight audit events.</p>
    </div>
  </main>;
}

export default function AdminPage({ searchParams }: { searchParams: Params }) {
  assertEditorialRoutesEnabled();
  return <Suspense fallback={<p className="p-6">Loading member activity…</p>}><Directory params={searchParams}/></Suspense>;
}
