"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApprovalCard,
  BrandKitCard,
  BuildPackCard,
  BuildPackPromptCard,
  CreditMeter,
  EmployeeCard,
  EmptyState,
  ErrorState,
  FromAttribution,
  LaunchPlanNudgeCard,
  LoadingState,
  MilestoneCard,
  SiteLiveCard,
  SkippedRoleCard,
  StatusPill,
  UserMessage,
  WORKSTREAM_KINDS,
  WrenComposer,
  WrenMessage,
  WrenThread,
  WorkstreamPanel,
  EMPLOYEE_STATUSES,
  OUTPUT_STATUSES,
  SITE_STATUSES,
} from "@/components/workspace/kit";
import type {
  ApprovalDecisionState,
  BrandKitCardState,
  WorkstreamData,
  WorkstreamOutput,
} from "@/components/workspace/kit";
import {
  freeCost,
  hydrotrailEmployees,
  hydrotrailPrompt,
  hydrotrailSkippedRoles,
  hydrotrailWorkstreams,
  irisIdentity,
  paidCost,
  shortCost,
} from "@/components/workspace/kit/fixtures";
import type { ApprovalCost, EmployeeIdentity } from "@/components/workspace/kit";
import { BTN_SECONDARY } from "@/components/workspace/kit/styles";
import type { RoleKey } from "@/lib/workspace/contracts/roster";

/**
 * Client wrapper for the dev-only kit preview. Every callback only updates local
 * state (approving flips the status, and so on) so focus behaviour can be exercised.
 * Nothing here talks to a server.
 */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-editorial text-2xl text-home-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

type ApprovalFixture = {
  id: string;
  title: string;
  from: EmployeeIdentity;
  cost: ApprovalCost;
  simulatePending?: boolean;
  staticPending?: boolean;
};

const APPROVALS: readonly ApprovalFixture[] = [
  { id: "free", title: "Welcome email (free)", from: irisIdentity, cost: freeCost },
  { id: "credits", title: "Brand kit board (2 credits)", from: irisIdentity, cost: paidCost },
  { id: "short", title: "Ad creative (not enough credits)", from: irisIdentity, cost: shortCost },
  { id: "slow", title: "Slow decision (pending for 1.5 s, then approved)", from: irisIdentity, cost: freeCost, simulatePending: true },
  { id: "stuck", title: "Decision in flight (always pending)", from: irisIdentity, cost: freeCost, staticPending: true },
];

type ApprovalRuntime = { state: ApprovalDecisionState; pending: boolean; message?: string };

function ApprovalsDemo() {
  const [runtime, setRuntime] = useState<Record<string, ApprovalRuntime>>({});
  const read = (id: string): ApprovalRuntime => runtime[id] ?? { state: "open", pending: false };
  const write = (id: string, next: ApprovalRuntime) => setRuntime((previous) => ({ ...previous, [id]: next }));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function approve(fixture: ApprovalFixture) {
    if (fixture.simulatePending) {
      write(fixture.id, { state: "open", pending: true });
      timers.current.push(
        setTimeout(() => write(fixture.id, { state: "approved", pending: false, message: "Approved. Wren will route this." }), 1500),
      );
      return;
    }
    write(fixture.id, { state: "approved", pending: false, message: "Approved. Wren will route this." });
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {APPROVALS.map((fixture) => {
        const current = read(fixture.id);
        return (
          <ApprovalCard
            key={fixture.id}
            id={fixture.id}
            title={fixture.title}
            from={fixture.from}
            cost={fixture.cost}
            state={current.state}
            pending={fixture.staticPending === true || current.pending}
            statusMessage={current.message}
            preview={<p className="text-[13px] text-home-ink-2">Preview area for the approval.</p>}
            onApprove={() => approve(fixture)}
            onAskChanges={() => write(fixture.id, { state: "changes", pending: false, message: "Changes asked." })}
          />
        );
      })}
    </ul>
  );
}

function EmployeesDemo() {
  const [autopilot, setAutopilot] = useState<Record<string, boolean>>({});
  const [gateMessage, setGateMessage] = useState("");
  const [hired, setHired] = useState<readonly RoleKey[]>([]);
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="min-h-5 text-[13px] text-home-ink-2">
        {gateMessage}
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {hydrotrailEmployees.map((employee, index) => (
          <EmployeeCard
            key={employee.id}
            employee={{ ...employee, autopilot: autopilot[employee.id] ?? employee.autopilot }}
            // Free plan for all but the last card, which shows the available switch.
            autopilotAvailable={index === hydrotrailEmployees.length - 1}
            workstreamHref="#workspace-main"
            onAutopilotToggle={(id, next) => {
              if (index === hydrotrailEmployees.length - 1) {
                setAutopilot((previous) => ({ ...previous, [id]: next }));
                return;
              }
              setGateMessage(`Autopilot for ${employee.name} is on paid plans. On Free, ${employee.name} asks before acting.`);
            }}
          />
        ))}
        {hydrotrailSkippedRoles.map((skipped) => (
          <SkippedRoleCard
            key={skipped.role}
            role={skipped.role}
            reason={skipped.reason}
            hireRequested={hired.includes(skipped.role)}
            onHire={(role) => setHired((previous) => [...previous, role])}
          />
        ))}
      </ul>
    </div>
  );
}

type ThreadStatus = "ready" | "loading" | "error";

function WrenDemo() {
  const [brandState, setBrandState] = useState<BrandKitCardState>("pending");
  const [sent, setSent] = useState<readonly string[]>([]);
  const [errorShown, setErrorShown] = useState(true);
  const statuses: readonly ThreadStatus[] = ["loading", errorShown ? "error" : "ready", "ready"];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-home-ink">Thread: loading</h3>
        <WrenThread status={statuses[0]} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-home-ink">Thread: error (Retry loads the messages)</h3>
        <WrenThread status={statuses[1]} onRetry={() => setErrorShown(false)} />
        {errorShown ? null : (
          <button
            type="button"
            className={`${BTN_SECONDARY} self-start`}
            onClick={() => setErrorShown(true)}
          >
            Show the error again
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-home-ink">Thread: ready, with the composer</h3>
        <div className="rounded-xl border border-home-rule bg-home-card">
          <div className="p-4">
            <WrenThread status={statuses[2]}>
              <WrenMessage time="9:02 AM">
                <p>Morning. Iris has the brand kit ready for your OK.</p>
              </WrenMessage>
              <FromAttribution from={irisIdentity} time="9:02 AM" workstreamHref="#workspace-main" />
              <BrandKitCard
                state={brandState}
                openHref="#workspace-main"
                onApprove={() => setBrandState("approved")}
                onAskChanges={() => setBrandState("asking")}
              />
              <UserMessage>Looks good, ship it.</UserMessage>
              <UserMessage failed onRetry={() => setSent((previous) => [...previous, "Retried message"])}>
                This one did not send.
              </UserMessage>
              <MilestoneCard title="Waitlist is live" detail="hydrotrail.example" time="9:10 AM" />
              <SiteLiveCard
                title="Your site is live"
                body="Leo published the landing page and the waitlist form."
                url="hydrotrail.example"
                href="https://example.com"
              />
              <BuildPackCard
                title="Your weekend build pack"
                titleTail="is unlocked"
                body="Eight prompts, four phases."
                caption="Opens in the Build pack page"
                openHref="#workspace-main"
              />
              <LaunchPlanNudgeCard message="Marco wrote your weekend plan." href="#workspace-main" />
              <WrenMessage time="9:12 AM">
                <p>Anything else you want changed?</p>
              </WrenMessage>
              {sent.map((text, index) => (
                <UserMessage key={`${index}-${text}`}>{text}</UserMessage>
              ))}
            </WrenThread>
          </div>
          <WrenComposer onSend={(text) => setSent((previous) => [...previous, text])} />
        </div>
      </div>
    </div>
  );
}

const CHANGES_SAMPLE: WorkstreamOutput = {
  id: "changes-sample",
  title: "Tagline options",
  kindLabel: "Copy",
  status: "changes_requested",
  changeNote: "Make it shorter and drop the second option.",
};

function withChangesSample(kind: WorkstreamData["kind"], data: WorkstreamData): WorkstreamData {
  return kind === "brand" ? { ...data, outputs: [...data.outputs, CHANGES_SAMPLE] } : data;
}

function WorkstreamDemo({ kind }: { kind: WorkstreamData["kind"] }) {
  const [data, setData] = useState<WorkstreamData>(() => withChangesSample(kind, hydrotrailWorkstreams[kind]));
  function update(id: string, patch: Partial<WorkstreamOutput>) {
    setData((previous) => ({
      ...previous,
      outputs: previous.outputs.map((output) => (output.id === id ? { ...output, ...patch } : output)),
    }));
  }
  return (
    <WorkstreamPanel
      businessName="HydroTrail"
      data={data}
      headingLevel={3}
      filesHref="#workspace-main"
      onApproveOutput={(id) => update(id, { status: "approved", statusMessage: "Approved. Wren will route this." })}
      onRequestChanges={(id, note) =>
        update(id, { status: "changes_requested", changeNote: note, statusMessage: "Change request sent." })
      }
      extra={
        kind === "engineering" ? (
          <div className="mt-2 flex flex-col gap-3">
            <BuildPackPromptCard {...hydrotrailPrompt} headingLevel={5} />
          </div>
        ) : null
      }
    />
  );
}

const CREDIT_CASES = [
  { label: "Normal", balance: 48, max: 50, plan: "free" },
  { label: "Low", balance: 8, max: 50, plan: "free" },
  { label: "Zero balance", balance: 0, max: 50, plan: "free" },
  { label: "Max 0, no balance", balance: 0, max: 0, plan: "free" },
  { label: "Max 0, balance 5 (not set)", balance: 5, max: 0, plan: "free" },
  { label: "Balance over max", balance: 600, max: 500, plan: "builders_hub" },
] as const;

export function KitPreviewClient() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-editorial text-4xl text-home-ink">
          Workspace kit <em>preview</em>
        </h1>
        <p className="text-sm text-home-ink-2">
          Development only. Mock data, no server calls. Use it for the keyboard, zoom and screen-reader check.
        </p>
      </header>

      <Section id="kit-pills" title="Status pills">
        <ul className="flex flex-wrap gap-2">
          {EMPLOYEE_STATUSES.map((status) => (
            <li key={status}>
              <StatusPill set="employee" status={status} />
            </li>
          ))}
          {OUTPUT_STATUSES.map((status) => (
            <li key={status}>
              <StatusPill set="output" status={status} />
            </li>
          ))}
          {SITE_STATUSES.map((status) => (
            <li key={status}>
              <StatusPill set="site" status={status} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="kit-credits" title="Credit meter">
        <ul className="grid gap-3 md:grid-cols-2">
          {CREDIT_CASES.map((credit) => (
            <li key={credit.label} className="rounded-xl border border-home-rule bg-home-card p-3">
              <p className="mb-2 text-xs text-home-ink-3">{credit.label}</p>
              <CreditMeter balance={credit.balance} max={credit.max} plan={credit.plan} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="kit-states" title="Empty, loading and error states">
        <EmptyState title="Nothing here yet">Approvals will show up here.</EmptyState>
        <LoadingState label="Loading approvals…" />
        <ErrorState message="Approvals didn't load." onRetry={() => undefined} />
      </Section>

      <Section id="kit-employees" title="Employees">
        <EmployeesDemo />
      </Section>

      <Section id="kit-approvals" title="Approvals">
        <ApprovalsDemo />
      </Section>

      <Section id="kit-wren" title="Wren thread">
        <WrenDemo />
      </Section>

      <Section id="kit-prompt" title="Build pack prompt">
        <BuildPackPromptCard {...hydrotrailPrompt} headingLevel={3} />
      </Section>

      <Section id="kit-workstreams" title="Workstream panels">
        <div className="flex flex-col gap-16">
          {WORKSTREAM_KINDS.map((kind) => (
            <WorkstreamDemo key={kind} kind={kind} />
          ))}
        </div>
      </Section>
    </div>
  );
}
