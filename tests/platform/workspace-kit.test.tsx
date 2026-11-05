import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  ApprovalCard,
  BrandKitCard,
  BrandKitCardView,
  BuildPackCard,
  BuildPackPromptCard,
  CreditMeter,
  EMPLOYEE_STATUSES,
  EmployeeCard,
  EmptyState,
  ErrorState,
  FromAttribution,
  LaunchPlanNudgeCard,
  LoadingState,
  MilestoneCard,
  OUTPUT_STATUSES,
  SiteLiveCard,
  SkippedRoleCard,
  StatusPill,
  UserMessage,
  WORKSTREAM_KINDS,
  WorkstreamPanel,
  WrenComposer,
  WrenMessage,
  WrenThread,
  copyButtonLabel,
  copyStatusMessage,
  copyText,
  costLabel,
  creditMeterState,
  prepareMessage,
  sanitizeCredits,
  shouldSendOnKeyDown,
  validateChangeNote,
} from "@/components/workspace/kit";
import { OutputCard } from "@/components/workspace/kit/WorkstreamPanel";
import {
  freeCost,
  hydrotrailCreditStates,
  hydrotrailEmployees,
  hydrotrailPrompt,
  hydrotrailSkippedRoles,
  hydrotrailWorkstreams,
  irisIdentity,
  paidCost,
  shortCost,
} from "@/components/workspace/kit/fixtures";

// No DOM library is installed in this repo, so these tests use the repo's
// renderToStaticMarkup pattern. For interaction, `expand` resolves hook-free
// function components into a host-element tree so handlers can be found and
// invoked. Native <button> elements get Enter/Space activation from the
// browser: the tests assert each control is a real button with no key-handler
// override that could break that.

type HostProps = { children?: ReactNode } & Record<string, unknown>;

function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<HostProps>;
  if (typeof el.type === "string") {
    return { ...el, props: { ...el.props, children: expand(el.props.children) } };
  }
  if (typeof el.type === "function") {
    const render = el.type as (props: HostProps) => ReactNode;
    return expand(render(el.props));
  }
  if (el.type === Fragment) return expand(el.props.children);
  return null;
}

function collect(node: ReactNode, test: (el: ReactElement<HostProps>) => boolean, out: ReactElement<HostProps>[] = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, test, out));
  } else if (isValidElement(node)) {
    const el = node as ReactElement<HostProps>;
    if (test(el)) out.push(el);
    collect(el.props.children, test, out);
  }
  return out;
}

function buttonsOf(tree: ReactNode) {
  return collect(tree, (el) => el.type === "button");
}

function expectNativeKeyboard(button: ReactElement<HostProps>) {
  expect(button.type).toBe("button");
  expect(button.props.type === "button" || button.props.type === "submit").toBe(true);
  expect(button.props.onKeyDown).toBeUndefined();
  expect(button.props.onKeyUp).toBeUndefined();
  expect(button.props.tabIndex).toBeUndefined();
}

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("StatusPill", () => {
  test("employee statuses always render their text label", () => {
    const labels = { queued: "Queued", working: "Working", needs_you: "Needs you", done: "Done" };
    for (const status of EMPLOYEE_STATUSES) {
      const out = html(<StatusPill set="employee" status={status} />);
      expect(out).toContain(labels[status]);
      expect(out).toContain(`data-status="${status}"`);
    }
  });

  test("output and site statuses render their labels", () => {
    const labels = { draft: "Draft", ready: "Ready for your OK", approved: "Approved", changes_requested: "Changes requested" };
    for (const status of OUTPUT_STATUSES) expect(html(<StatusPill set="output" status={status} />)).toContain(labels[status]);
    expect(html(<StatusPill set="site" status="live" />)).toContain("Live");
  });

  test("the dot is decorative and a label override still shows text", () => {
    const out = html(<StatusPill set="employee" status="working" label="Working · Routing 4 approvals" />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("Working · Routing 4 approvals");
  });
});

describe("EmployeeCard", () => {
  const iris = hydrotrailEmployees[0];
  const ada = hydrotrailEmployees[7];

  test("renders every label from a fixture", () => {
    const out = html(
      <EmployeeCard employee={iris} autopilotAvailable={false} workstreamHref="/team/iris" onAutopilotToggle={() => {}} />,
    );
    for (const text of ["Iris", "Brand", "Needs you", "Logo, palette, type and voice", "Status detail: ", "Brand kit ready for your OK", "Open workstream", " · Iris, Brand"]) {
      expect(out).toContain(text);
    }
    expect(out).toContain('href="/team/iris"');
    expect(out).toContain('aria-label="Iris, Brand (AI employee)"');
  });

  test("blocker line names who it waits on", () => {
    const out = html(<EmployeeCard employee={ada} autopilotAvailable workstreamHref="/team/ada" onAutopilotToggle={() => {}} />);
    expect(out).toContain("Waiting on Brand");
    expect(out).toContain("the creative needs the approved logo");
  });

  test("the autopilot switch has role=switch, aria-checked and the Free tooltip", () => {
    const out = html(<EmployeeCard employee={iris} autopilotAvailable={false} workstreamHref="/x" onAutopilotToggle={() => {}} />);
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="false"');
    expect(out).toContain('aria-label="Autopilot for Iris, Brand (paid plans)"');
    expect(out).toContain('title="Autopilot is on paid plans. On Free, Iris asks before acting."');
    expect(out).toContain('aria-describedby="employee-iris-autopilot-hint"');
    expect(out).toContain('id="employee-iris-autopilot-hint" class="sr-only">Autopilot is on paid plans. On Free, Iris asks before acting.');
    const on = html(<EmployeeCard employee={hydrotrailEmployees[6]} autopilotAvailable workstreamHref="/x" onAutopilotToggle={() => {}} />);
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('title="Autopilot for Kai"');
  });

  test("the switch is a native button that reports the toggled value", () => {
    const onToggle = vi.fn();
    const tree = expand(<EmployeeCard employee={iris} autopilotAvailable workstreamHref="/x" onAutopilotToggle={onToggle} />);
    const sw = buttonsOf(tree).find((b) => b.props.role === "switch");
    expect(sw).toBeDefined();
    expectNativeKeyboard(sw as ReactElement<HostProps>);
    (sw?.props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledWith("iris", true);
  });

  test("the needs-you card gets the ember border", () => {
    const out = html(<EmployeeCard employee={iris} autopilotAvailable workstreamHref="/x" onAutopilotToggle={() => {}} />);
    expect(out).toContain("border-home-orange-ink/30");
  });

  test("skipped-role variant shows the reason and a Hire button", () => {
    const skipped = hydrotrailSkippedRoles[0];
    const onHire = vi.fn();
    const out = html(<SkippedRoleCard role={skipped.role} reason={skipped.reason} onHire={onHire} />);
    expect(out).toContain("Merch");
    expect(out).toContain("Skipped");
    expect(out).toContain("nothing physical to sell");
    expect(out).toContain('aria-label="Hire Merch"');
    const hire = buttonsOf(expand(<SkippedRoleCard role="merch" reason="r" onHire={onHire} />))[0];
    expectNativeKeyboard(hire);
    (hire.props.onClick as () => void)();
    expect(onHire).toHaveBeenCalledWith("merch");
    const requested = html(<SkippedRoleCard role="merch" reason="r" hireRequested onHire={onHire} />);
    expect(requested).toContain("Hire requested");
    expect(requested).toContain('aria-disabled="true"');
    expect(requested).not.toMatch(/\sdisabled=""/);
    const requestedHire = buttonsOf(expand(<SkippedRoleCard role="merch" reason="r" hireRequested onHire={onHire} />))[0];
    onHire.mockClear();
    (requestedHire.props.onClick as () => void)();
    expect(onHire).not.toHaveBeenCalled();
  });
});

describe("ApprovalCard", () => {
  const base = {
    id: "brand-kit",
    title: "Brand kit",
    from: irisIdentity,
    cost: freeCost,
    state: "open" as const,
    onApprove: () => {},
    onAskChanges: () => {},
  };

  test("renders title, attribution, both buttons and a polite live region", () => {
    const out = html(<ApprovalCard {...base} />);
    for (const text of ["Brand kit", "From Brand · Iris", "Looks good", "Ask for changes", " · Brand kit"]) {
      expect(out).toContain(text);
    }
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('aria-pressed="false"');
  });

  test("cost badge has three states, each with a text label", () => {
    expect(costLabel(freeCost)).toBe("Free");
    expect(costLabel(paidCost)).toBe("2 credits");
    expect(costLabel(shortCost)).toBe("4 credits · not enough");
    expect(html(<ApprovalCard {...base} cost={freeCost} />)).toContain('data-cost="free"');
    expect(html(<ApprovalCard {...base} cost={paidCost} />)).toContain("2 credits");
    const short = html(<ApprovalCard {...base} cost={shortCost} />);
    expect(short).toContain('data-cost="not-enough"');
    expect(short).toContain("4 credits · not enough");
  });

  test("approved and changes states set aria-pressed and show the status message", () => {
    const approved = html(<ApprovalCard {...base} state="approved" statusMessage="Brand kit approved. Iris moves on." />);
    expect(approved).toContain('<span aria-hidden="true">✓ </span>Looks good');
    expect(approved).toContain("Brand kit approved. Iris moves on.");
    expect(approved.match(/aria-pressed="true"/g)).toHaveLength(1);
    const changes = html(<ApprovalCard {...base} state="changes" statusMessage="Changes asked on the brand kit." />);
    expect(changes).toContain("Changes asked on the brand kit.");
    expect(changes.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  test("buttons are native, call the handlers, and disable while pending", () => {
    const onApprove = vi.fn();
    const onAsk = vi.fn();
    const tree = expand(<ApprovalCard {...base} onApprove={onApprove} onAskChanges={onAsk} />);
    const [approve, ask] = buttonsOf(tree);
    expectNativeKeyboard(approve);
    expectNativeKeyboard(ask);
    (approve.props.onClick as () => void)();
    (ask.props.onClick as () => void)();
    expect(onApprove).toHaveBeenCalledWith("brand-kit");
    expect(onAsk).toHaveBeenCalledWith("brand-kit");

    const pendingOut = html(<ApprovalCard {...base} pending />);
    expect(pendingOut).toContain('aria-busy="true"');
    expect(pendingOut).toContain("Sending your decision…");
    expect(pendingOut.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(pendingOut).not.toMatch(/\sdisabled=""/);
    const guarded = vi.fn();
    const [gApprove, gAsk] = buttonsOf(expand(<ApprovalCard {...base} pending onApprove={guarded} onAskChanges={guarded} />));
    (gApprove.props.onClick as () => void)();
    (gAsk.props.onClick as () => void)();
    expect(guarded).not.toHaveBeenCalled();
  });
});

describe("Wren thread", () => {
  test("the list is a labelled log; loading and error are announced", () => {
    const ready = html(<WrenThread><WrenMessage time="Thu 9:02 PM">Hey John</WrenMessage></WrenThread>);
    expect(ready).toContain('role="log"');
    expect(ready).not.toContain("aria-live");
    expect(ready).toContain('aria-label="Messages"');
    expect(ready).toContain("Wren");
    expect(ready).toContain("Thu 9:02 PM");
    expect(ready).toContain("Hey John");

    const loading = html(<WrenThread status="loading" />);
    expect(loading).not.toContain('role="log"');
    expect(loading).toContain('role="status"');
    expect(loading).toContain("Loading messages…");

    const onRetry = vi.fn();
    const error = html(<WrenThread status="error" onRetry={onRetry} />);
    expect(error).toContain('role="alert"');
    expect(error).not.toContain('role="log"');
    expect(error).toContain("Retry loading messages");
    const retry = buttonsOf(expand(<WrenThread status="error" onRetry={onRetry} />))[0];
    expectNativeKeyboard(retry);
    (retry.props.onClick as () => void)();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("FromAttribution credits the specialist and links to the workstream", () => {
    const out = html(<FromAttribution from={irisIdentity} time="Thu 9:20 PM" workstreamHref="/team/iris" />);
    expect(out).toContain("From Brand");
    expect(out).toContain("Iris");
    expect(out).toContain("routed by Wren");
    expect(out).toContain("Workstream");
    expect(out).toContain('href="/team/iris"');
    expect(out).toContain('aria-label="Iris, Brand (AI employee)"');
  });

  test("brand kit card states and buttons", () => {
    const onApprove = vi.fn();
    const props = { openHref: "/brand", onApprove, onAskChanges: () => {} };
    const pending = html(<BrandKitCard {...props} state="pending" />);
    for (const text of ["Generated brand kit · 9 pieces", "Looks good", "Ask for changes", "Open brand kit"]) expect(pending).toContain(text);
    expect(pending.match(/ · brand kit/g)).toHaveLength(2);
    const busy = html(<BrandKitCard {...props} state="pending" pending />);
    expect(busy).toContain('aria-disabled="true"');
    expect(busy).toContain("Sending your decision…");
    const guard = vi.fn();
    const [busyApprove] = buttonsOf(expand(<BrandKitCardView {...props} onApprove={guard} state="pending" pending />));
    (busyApprove.props.onClick as () => void)();
    expect(guard).not.toHaveBeenCalled();
    expect(html(<BrandKitCard {...props} state="approved" />)).toContain("Approved. Site, emails and Studio now use it.");
    expect(html(<BrandKitCard {...props} state="asking" />)).toContain("Tell me what to change below");
    const [approve] = buttonsOf(expand(<BrandKitCardView {...props} state="pending" />));
    expectNativeKeyboard(approve);
    (approve.props.onClick as () => void)();
    expect(onApprove).toHaveBeenCalled();
  });

  test("milestone, site live, build pack and launch plan cards", () => {
    expect(html(<MilestoneCard title="Site deployed" detail="Landing + waitlist live" time="Thu 9:14 PM" />)).toContain("Milestone reached: ");
    const site = html(<SiteLiveCard title="HydroTrail is live" body="Landing page, waitlist and privacy page." url="hydrotrail.weekendmvp.app" href="https://hydrotrail.weekendmvp.app" />);
    expect(site).toContain("hydrotrail.weekendmvp.app");
    expect(site).toContain("Live");
    expect(site).toContain("Open site");
    expect(site).toContain("(opens in a new tab)");
    expect(site).toContain('rel="noopener noreferrer"');
    const pack = html(<BuildPackCard title="Build the real HydroTrail app —" titleTail="not just the page." body="4 phases · 8 prompts" caption="Phase 1 takes about 45 min" openHref="/build-pack" />);
    for (const text of ["Weekend build pack unlocked", "Open build pack", "Phase 1 takes about 45 min", "not just the page."]) expect(pack).toContain(text);
    const nudge = html(<LaunchPlanNudgeCard message="5 of 8 launch items are ready." href="/launch" />);
    expect(nudge).toContain("Open weekend launch plan");
    expect(nudge).toContain('href="/launch"');
  });

  test("user message shows a retry when the send failed", () => {
    const onRetry = vi.fn();
    expect(html(<UserMessage>Hello</UserMessage>)).not.toContain("Not sent.");
    const failed = html(<UserMessage failed onRetry={onRetry}>Hello</UserMessage>);
    expect(failed).toContain("Not sent.");
    expect(failed).toContain("Retry sending");
    const retry = buttonsOf(expand(<UserMessage failed onRetry={onRetry}>Hello</UserMessage>))[0];
    expectNativeKeyboard(retry);
    (retry.props.onClick as () => void)();
    expect(onRetry).toHaveBeenCalled();
  });

  test("composer has a labelled textarea and a named send button", () => {
    const out = html(<WrenComposer onSend={() => {}} />);
    expect(out).toContain("Message Wren");
    expect(out).toContain('placeholder="Message Wren…"');
    expect(out).toContain('aria-label="Send message"');
    expect(out).toMatch(/for="([^"]+)"/);
    const sending = html(<WrenComposer onSend={() => {}} sending />);
    expect(sending).toContain('aria-disabled="true"');
    expect(sending).not.toMatch(/\sdisabled=""/);
  });

  test("an empty draft never sends and a real one is trimmed", () => {
    expect(prepareMessage("")).toBeNull();
    expect(prepareMessage("   \n ")).toBeNull();
    expect(prepareMessage("  hi  ")).toBe("hi");
  });
});

describe("WorkstreamPanel", () => {
  test.each(WORKSTREAM_KINDS)("renders the %s workstream from fixtures", (kind) => {
    const data = hydrotrailWorkstreams[kind];
    const out = html(
      <WorkstreamPanel businessName="HydroTrail" data={data} onApproveOutput={() => {}} onRequestChanges={() => {}} filesHref="/files" />,
    );
    expect(out).toContain("AI employee · HydroTrail workstream");
    expect(out).toContain(data.employee.name);
    expect(out).toContain("Reports to");
    for (const label of ["Brief", "from the Blueprint", "Outputs", "for your OK", "Files", "Blockers", "Open all files"]) expect(out).toContain(label);
    for (const output of data.outputs) expect(out).toContain(output.title.replace(/&/g, "&amp;"));
    for (const file of data.files) expect(out).toContain(file.name);
    expect(out).toContain("outputs ·");
    expect(out).toMatch(/aria-labelledby="[^"]+-h"/);
    expect(out).toContain("<h1 ");
  });

  test("status text, blocker severity and holds are shown in words", () => {
    const ads = html(<WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams.ads} onApproveOutput={() => {}} onRequestChanges={() => {}} />);
    expect(ads).toContain("Ada is waiting on");
    expect(ads).toContain("Blocking · Brand");
    const brand = html(<WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams.brand} onApproveOutput={() => {}} onRequestChanges={() => {}} />);
    expect(brand).toContain("Waiting on Iris");
    expect(brand).toContain("Ready for your OK");
    expect(brand).toContain("Approved · Wren will route this");
    expect(brand).toContain("No blockers. Iris needs only your OK");
  });

  test("ready outputs get decision buttons; the ask disclosure is aria-expanded", () => {
    const out = html(<WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams.brand} onApproveOutput={() => {}} onRequestChanges={() => {}} />);
    expect(out).toContain("Looks good");
    expect(out).toContain("Ask for changes");
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('role="status"');
  });

  test("message and validation helpers", () => {
    expect(validateChangeNote("", "Iris", "Logo lockup")).toBe("Write what Iris should change in Logo lockup first.");
    expect(validateChangeNote("  ", "Iris", "Logo lockup")).not.toBeNull();
    expect(validateChangeNote("Keep the mark", "Iris", "Logo lockup")).toBeNull();
  });

  test("prompt card shows its fields and a named copy button", () => {
    const out = html(<BuildPackPromptCard {...hydrotrailPrompt} />);
    for (const text of ["PROMPT 2 · 30 MIN", "Data model + carry formula", "Copy prompt", "Do not build:", "Done when:", "For Claude Code"]) expect(out).toContain(text);
    expect(out).toContain('aria-label="Copy prompt 2: Data model + carry formula"');
    expect(out).toContain('role="status"');
  });

  test("copy resolves to copied or blocked and never throws", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyText("x", { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("x");
    await expect(copyText("x", { writeText: vi.fn().mockRejectedValue(new Error("denied")) })).resolves.toBe("blocked");
    await expect(copyText("x", undefined)).resolves.toBe("blocked");
    expect(copyStatusMessage("copied", 2, "Claude Code")).toBe("Copied Prompt 2 for Claude Code.");
    expect(copyStatusMessage("blocked", 2, "Claude Code")).toContain("Copy is blocked in this preview.");
    expect(copyStatusMessage("idle", 2, "Claude Code")).toBe("");
  });
});

describe("CreditMeter", () => {
  test("state thresholds: normal, low at 20 percent or less, zero", () => {
    expect(creditMeterState(48, 50)).toBe("normal");
    expect(creditMeterState(11, 50)).toBe("normal");
    expect(creditMeterState(10, 50)).toBe("low");
    expect(creditMeterState(8, 50)).toBe("low");
    expect(creditMeterState(0, 50)).toBe("zero");
  });

  test("normal state: meter attributes, text, note", () => {
    const out = html(<CreditMeter {...hydrotrailCreditStates.normal} />);
    expect(out).toContain('role="meter"');
    expect(out).toContain('aria-valuemin="0"');
    expect(out).toContain('aria-valuemax="50"');
    expect(out).toContain('aria-valuenow="48"');
    expect(out).toContain('aria-valuetext="48 of 50 credits left"');
    expect(out).toContain('aria-label="Credits"');
    expect(out).toContain("48 left");
    expect(out).toContain("Free · 50 starter credits, one-time");
  });

  test("low and zero states say so in words", () => {
    const low = html(<CreditMeter {...hydrotrailCreditStates.low} />);
    expect(low).toContain("8 left · low");
    expect(low).toContain('aria-valuetext="8 of 50 credits left"');
    const zero = html(<CreditMeter {...hydrotrailCreditStates.zero} />);
    expect(zero).toContain("0 left");
    expect(zero).toContain('aria-valuenow="0"');
    expect(zero).toContain("Studio extras paused · see plans");
  });

  test("paid plan note", () => {
    const out = html(<CreditMeter {...hydrotrailCreditStates.paid} />);
    expect(out).toContain("Builder&#x27;s Hub");
    expect(out).toContain("500 refresh on the 5th");
  });
});

describe("Empty, loading and error states", () => {
  test("empty state shows its text", () => {
    expect(html(<EmptyState>Nobody needs you right now. Wren will bring the next decision here.</EmptyState>)).toContain("Nobody needs you right now.");
  });

  test("loading state is a status, has a text label and stops its spinner for reduced motion", () => {
    const out = html(<LoadingState label="Loading the team…" />);
    expect(out).toContain('role="status"');
    expect(out).toContain("Loading the team…");
    expect(out).toContain("motion-reduce:animate-none");
  });

  test("error state is an alert with a working retry button", () => {
    const onRetry = vi.fn();
    const out = html(<ErrorState message="The team didn't load." onRetry={onRetry} />);
    expect(out).toContain('role="alert"');
    expect(out).toContain("The team didn&#x27;t load.");
    expect(out).toContain("Try again");
    const retry = buttonsOf(expand(<ErrorState message="m" onRetry={onRetry} />))[0];
    expectNativeKeyboard(retry);
    (retry.props.onClick as () => void)();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(html(<ErrorState message="m" />)).not.toContain("<button");
  });
});

describe("review fixes", () => {
  test("shouldSendOnKeyDown: Enter sends; Shift+Enter, composition and keyCode 229 do not", () => {
    const base = { key: "Enter", shiftKey: false, isComposing: false };
    expect(shouldSendOnKeyDown(base)).toBe(true);
    expect(shouldSendOnKeyDown({ ...base, keyCode: 13 })).toBe(true);
    expect(shouldSendOnKeyDown({ ...base, shiftKey: true })).toBe(false);
    expect(shouldSendOnKeyDown({ ...base, isComposing: true })).toBe(false);
    expect(shouldSendOnKeyDown({ ...base, keyCode: 229 })).toBe(false);
    expect(shouldSendOnKeyDown({ ...base, key: "a" })).toBe(false);
  });

  test("costLabel pluralises and treats 0 credits as Free", () => {
    expect(costLabel({ kind: "credits", credits: 1, balance: 10 })).toBe("1 credit");
    expect(costLabel({ kind: "credits", credits: 2, balance: 10 })).toBe("2 credits");
    expect(costLabel({ kind: "credits", credits: 0, balance: 10 })).toBe("Free");
    expect(costLabel({ kind: "credits", credits: 1, balance: 0 })).toBe("1 credit · not enough");
    expect(html(<ApprovalCard id="a" title="t" from={irisIdentity} cost={{ kind: "credits", credits: 0, balance: 0 }} state="open" onApprove={() => {}} onAskChanges={() => {}} />)).toContain('data-cost="free"');
  });

  test("CreditMeter edge cases: max 0, balance over max, negative, NaN", () => {
    expect(sanitizeCredits(Number.NaN)).toBe(0);
    expect(sanitizeCredits(-5)).toBe(0);
    expect(sanitizeCredits(Number.POSITIVE_INFINITY)).toBe(0);
    expect(creditMeterState(5, 0)).toBe("normal");
    expect(creditMeterState(0, 0)).toBe("zero");
    expect(creditMeterState(-3, 50)).toBe("zero");
    expect(creditMeterState(Number.NaN, 50)).toBe("zero");
    expect(creditMeterState(600, 500)).toBe("normal");

    const over = html(<CreditMeter balance={600} max={500} plan="builders_hub" />);
    expect(over).toContain("600 left");
    expect(over).toContain('aria-valuetext="600 of 500 credits left"');
    expect(over).toContain('aria-valuenow="500"');
    expect(over).toContain('aria-valuemax="500"');
    expect(over).toContain("w-full");

    const noMax = html(<CreditMeter balance={5} max={0} plan="free" />);
    expect(noMax).toContain('aria-valuemax="0"');
    expect(noMax).toContain('aria-valuenow="0"');
    expect(noMax).toContain("No credit allowance on this plan");
    expect(noMax).toContain('aria-valuetext="Credit allowance not set"');
    expect(noMax).toContain("Not set");
    expect(noMax).not.toContain("5 left");
    expect(html(<CreditMeter balance={0} max={0} plan="free" />)).toContain("0 left");

    const nan = html(<CreditMeter balance={Number.NaN} max={Number.NaN} plan="free" />);
    expect(nan).toContain("0 left");
    expect(nan).toContain('aria-valuenow="0"');
    expect(nan).not.toContain("NaN");
    expect(html(<CreditMeter balance={-4} max={50} plan="free" />)).toContain('aria-valuenow="0"');
    expect(html(<CreditMeter balance={8} max={50} plan="free" />)).toContain("bg-home-ochre-ink");
  });

  test("workstream: pending outputs, parent-owned status message, hidden form, plural, heading levels", () => {
    const data = {
      ...hydrotrailWorkstreams.brand,
      outputs: [
        { ...hydrotrailWorkstreams.brand.outputs[0], pending: true },
        { ...hydrotrailWorkstreams.brand.outputs[1], statusMessage: "Logo lockup approved. Wren will route this." },
      ],
    };
    const out = html(<WorkstreamPanel businessName="HydroTrail" data={data} headingLevel={2} onApproveOutput={() => {}} onRequestChanges={() => {}} />);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("Sending your decision…");
    expect(out).toContain('aria-disabled="true"');
    expect(out).not.toMatch(/\sdisabled=""/);
    expect(out).toContain("Logo lockup approved. Wren will route this.");
    expect(out).toMatch(/<form [^>]*hidden/);
    expect(out).toContain("<h2 ");
    expect(out).toContain("<h3 ");
    expect(out).toContain("<h4 ");
    expect(out).not.toContain("<h1 ");
    expect(out).toContain("2 outputs");
    const one = html(<WorkstreamPanel businessName="HydroTrail" data={{ ...data, outputs: [data.outputs[0]] }} onApproveOutput={() => {}} onRequestChanges={() => {}} />);
    expect(one).toContain("1 output ·");
  });

  test("prompt card: accessible name tracks the visible text; heading level is configurable", () => {
    // Stable name that starts with the always-visible button text "Copy prompt".
    expect(copyButtonLabel(2, "T")).toBe("Copy prompt 2: T");
    const card = html(<BuildPackPromptCard {...hydrotrailPrompt} />);
    expect(card).toContain(">Copy prompt</button>");
    expect(card).not.toContain("Copied</button>");
    expect(card).toMatch(/role="status" aria-live="polite"[^>]*><span><\/span>/);
    expect(html(<BuildPackPromptCard {...hydrotrailPrompt} />)).toContain("<h3 ");
    expect(html(<BuildPackPromptCard {...hydrotrailPrompt} headingLevel={4} />)).toContain("<h4 ");
  });
});

/** Every ARIA reference and label target must resolve to a unique id in the same markup. */
function expectIdIntegrity(markup: string, requiredAttrs: readonly string[] = []) {
  for (const attr of requiredAttrs) expect(markup, `missing ${attr}`).toMatch(new RegExp(`\\s${attr}="[^"]+"`));
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  const refs: string[] = [];
  for (const m of markup.matchAll(/\s(?:aria-describedby|aria-labelledby|aria-controls)="([^"]+)"/g)) refs.push(...m[1].split(/\s+/));
  for (const m of markup.matchAll(/\sfor="([^"]+)"/g)) refs.push(m[1]);
  for (const ref of refs) expect(ids, `dangling reference: ${ref}`).toContain(ref);
  return { ids, refs };
}

describe("id integrity", () => {
  test("every fixture render resolves its ARIA references with unique ids", () => {
    const noop = () => {};
    const employees = html(
      <ul>
        {hydrotrailEmployees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} autopilotAvailable={false} workstreamHref="/x" onAutopilotToggle={noop} />
        ))}
      </ul>,
    );
    expect(expectIdIntegrity(employees).refs.length).toBeGreaterThan(0);

    const approvals = html(
      <ul>
        <ApprovalCard id="a" title="A" from={irisIdentity} cost={freeCost} state="open" onApprove={noop} onAskChanges={noop} />
        <ApprovalCard id="b" title="B" from={irisIdentity} cost={paidCost} state="approved" onApprove={noop} onAskChanges={noop} />
      </ul>,
    );
    expect(expectIdIntegrity(approvals).refs.length).toBe(2);

    for (const kind of WORKSTREAM_KINDS) {
      const panel = html(<WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams[kind]} onApproveOutput={noop} onRequestChanges={noop} />);
      expectIdIntegrity(panel);
    }
    const both = html(
      <>
        <WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams.brand} onApproveOutput={noop} onRequestChanges={noop} />
        <WorkstreamPanel businessName="HydroTrail" data={hydrotrailWorkstreams.brand} onApproveOutput={noop} onRequestChanges={noop} />
        <WrenComposer onSend={noop} />
        <WrenComposer onSend={noop} />
      </>,
    );
    expectIdIntegrity(both);
    expectIdIntegrity(html(<BrandKitCard state="pending" openHref="/b" onApprove={noop} onAskChanges={noop} />));
  });
});

describe("OutputCard states (id integrity, focus targets, live regions)", () => {
  const noop = () => {};
  const ready = { id: "kit", title: "Brand kit", kindLabel: "Board", status: "ready" as const };
  const card = (props: Partial<Parameters<typeof OutputCard>[0]> = {}) =>
    html(
      <ul>
        <OutputCard output={ready} employeeName="Iris" titleLevel={3} onApprove={noop} onRequestChanges={noop} {...props} />
      </ul>,
    );

  test("collapsed: the form exists but is hidden, and aria-controls resolves to it", () => {
    const out = card();
    expectIdIntegrity(out, ["aria-controls", "for"]);
    expect(out).toMatch(/<form [^>]*hidden/);
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('tabindex="-1"');
  });

  test("open: the form is shown and expanded", () => {
    const out = card({ initialAsking: true });
    expectIdIntegrity(out, ["aria-controls", "for"]);
    expect(out).not.toMatch(/<form [^>]*hidden/);
    expect(out).toContain('aria-expanded="true"');
  });

  test("error: role=alert text is the textarea's description and references resolve", () => {
    const out = card({ initialAsking: true, initialError: "Write what Iris should change in Brand kit first." });
    const { ids } = expectIdIntegrity(out, ["aria-controls", "aria-describedby", "for"]);
    expect(out).toContain('aria-invalid="true"');
    expect(out).toMatch(/<p id="[^"]+-note-error" role="alert"/);
    expect(ids.some((id) => id.endsWith("-note-error"))).toBe(true);
  });

  test("the form cannot stay open once the status is no longer ready", () => {
    const out = card({ output: { ...ready, status: "changes_requested" }, initialAsking: true, initialError: "x" });
    expect(out).toMatch(/<form [^>]*hidden/);
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain("aria-controls");
  });

  test("BrandKitCard: its status is a live region alone, and silent inside a thread log", () => {
    const props = { openHref: "/b", onApprove: noop, onAskChanges: noop, state: "approved" as const };
    expect(html(<BrandKitCard {...props} />)).toContain('role="status"');
    const inLog = html(<WrenThread><BrandKitCard {...props} /></WrenThread>);
    expect(inLog).toContain('role="log"');
    expect(inLog).not.toContain('role="status"');
    expect(inLog).toContain("Approved. Site, emails and Studio now use it.");
    expect(html(<WrenThread><BrandKitCard {...props} announce /></WrenThread>)).toContain('role="status"');
  });

  test("pending styles are visible for every button style", async () => {
    const styles = await import("@/components/workspace/kit/styles");
    for (const cls of [styles.BTN_PRIMARY, styles.BTN_SECONDARY, styles.BTN_APPROVED, styles.BTN_CHANGES, styles.ICON_BTN]) {
      expect(cls).toContain("aria-disabled:bg-home-sunk");
      expect(cls).toContain("aria-disabled:text-home-ink-2");
      expect(cls).toContain("aria-disabled:border-dashed");
    }
  });
});
