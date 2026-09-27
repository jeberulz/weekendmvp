import type { Metadata } from "next";
import { Suspense } from "react";

import { GatedPageHeader } from "@/components/admin/editorial/common/GatedPageHeader";
import { ListSkeleton } from "@/components/admin/editorial/common/ListSkeleton";
import { ErrorState, PageBody, StatusBadge } from "@/components/admin/editorial/common/primitives";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Settings — Editorial" } };
}

function YesNo({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return <StatusBadge tone={value ? "success" : "neutral"}>{value ? yes : no}</StatusBadge>;
}

export default function SettingsPage() {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" rows={4} />}>
        <GatedPageHeader
          title="Settings"
          description="What this workspace can actually do right now. Configured, verified and available are shown separately; no secret values appear here."
        />
        <SettingsContent />
      </Suspense>
    </PageBody>
  );
}

async function SettingsContent() {
  const workspace = await requireEditorialWorkspace();
  const settings = await workspace.repository.getSettings();
  if (!settings.ok) {
    return (
      <ErrorState title="Settings could not be loaded">
        {settings.error.message} <span className="font-mono">({settings.error.code})</span>
      </ErrorState>
    );
  }
  const view = settings.value;
  return (
    <>
      <section aria-labelledby="settings-simulated" className="rounded-lg border border-(--ed-demo) bg-(--ed-demo-bg) p-4 text-(--ed-demo)">
        <h2 id="settings-simulated" className="text-base font-semibold">
          What is simulated in local demo mode
        </h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li>All ideas, sources, quotes and numbers are fictional and use reserved example domains.</li>
          <li>Checks are a simplified simulation, not the idea engine&apos;s verification (WP45).</li>
          <li>Approvals, re-authentication and releases are simulated. Nothing is deployed, cached or published.</li>
          <li>Data lives in this development server&apos;s memory and resets when it restarts.</li>
        </ul>
      </section>

      <section aria-labelledby="settings-access" className="flex flex-col gap-3 rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
        <h2 id="settings-access" className="text-base font-semibold">
          Access
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-(--ed-text-2)">Signed in as</dt>
          <dd>{view.principal.label}</dd>
          <dt className="text-(--ed-text-2)">Editorial capability</dt>
          <dd className="flex flex-col gap-1">
            <span className="flex flex-wrap gap-1.5">
              <YesNo value={view.capability.configured} yes="Configured" no="Not configured" />
              <YesNo value={view.capability.verified} yes="Verified" no="Not verified" />
            </span>
            <span className="text-(--ed-text-2)">{view.capability.detail}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Recent strong authentication</dt>
          <dd className="flex flex-col gap-1">
            <span>
              {view.strongAuth.at ? formatAbsolute(view.strongAuth.at) : "Not confirmed in this session"}{" "}
              <YesNo value={view.strongAuth.fresh} yes="Fresh" no="Needed before publishing" />
            </span>
            <span className="text-(--ed-text-2)">{view.strongAuth.mechanism}</span>
          </dd>
        </dl>
      </section>

      <section aria-labelledby="settings-integrations" className="flex flex-col gap-3">
        <h2 id="settings-integrations" className="text-base font-semibold">
          Integrations
        </h2>
        <div className="overflow-x-auto rounded-lg border border-(--ed-border) bg-(--ed-surface)">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Integration status</caption>
            <thead>
              <tr className="border-b border-(--ed-border-strong) text-left">
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Integration</th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Configured</th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Verified</th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Available</th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Detail</th>
              </tr>
            </thead>
            <tbody>
              {view.integrations.map((integration) => (
                <tr key={integration.id} className="border-b border-(--ed-border) align-top last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    {integration.label}
                  </th>
                  <td className="px-3 py-3">
                    <YesNo value={integration.configured} yes="Yes" no="No" />
                  </td>
                  <td className="px-3 py-3">
                    <YesNo value={integration.verified} yes="Yes" no="No" />
                  </td>
                  <td className="px-3 py-3">
                    <YesNo value={integration.available} yes="Yes" no="No" />
                  </td>
                  <td className="min-w-[16rem] px-3 py-3 text-(--ed-text-2)">{integration.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="settings-policy" className="flex flex-col gap-3 rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
        <h2 id="settings-policy" className="text-base font-semibold">
          Quality policy and publishing
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-(--ed-text-2)">Policy version</dt>
          <dd>
            <span className="font-mono">{view.policy.version}</span>
            <span className="text-(--ed-text-2)"> — {view.policy.label}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Required checks</dt>
          <dd className="font-mono text-xs">{view.policy.requiredChecks.join(", ")}</dd>
          <dt className="text-(--ed-text-2)">Publishing readiness</dt>
          <dd className="flex flex-col gap-1">
            <span>
              <StatusBadge tone={view.publishing.readiness === "ready" ? "success" : "warning"}>
                {view.publishing.readiness === "simulated" ? "Simulated only" : view.publishing.readiness === "ready" ? "Ready" : "Unavailable"}
              </StatusBadge>
            </span>
            <span className="text-(--ed-text-2)">{view.publishing.detail}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Publishing kill switch</dt>
          <dd>
            <StatusBadge tone={view.publishing.killSwitchEngaged ? "danger" : "neutral"}>
              {view.publishing.killSwitchEngaged ? "Engaged: new activations blocked" : "Released"}
            </StatusBadge>
          </dd>
        </dl>
      </section>
    </>
  );
}
