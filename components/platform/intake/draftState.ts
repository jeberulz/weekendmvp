export type DraftInput = {
  title: string;
  problem: string;
  audience: string;
  outcome: string;
  constraints: string;
};

export function serializeDraftInput(input: DraftInput): string {
  return JSON.stringify(input);
}

export function hasMeaningfulDraftInput(input: DraftInput): boolean {
  return Object.values(input).some((value) => value.trim().length > 0);
}

type ReconcileArgs = {
  localInput: DraftInput;
  lastSavedSerialized: string;
  localUpdatedAt: number;
  serverInput: DraftInput;
  serverUpdatedAt: number;
};

export type DraftReconciliation =
  | { kind: "unchanged" }
  | { kind: "hydrate"; input: DraftInput; updatedAt: number; serialized: string }
  | { kind: "conflict" };

type InitialSaveArgs = {
  attemptedInput: DraftInput;
  currentInput: DraftInput;
  serverInput: DraftInput;
  acceptedInput: boolean;
};

export type InitialSaveReconciliation =
  | {
      kind: "saved";
      input: DraftInput;
      serialized: string;
    }
  | { kind: "dirty"; serialized: string }
  | { kind: "conflict"; serialized: string };

/**
 * The first mutation is idempotent, so another tab may create the graph first.
 * Its response is authoritative: never call local text saved unless it matches
 * the canonical stored input. A losing caller keeps its text and conflicts.
 */
export function reconcileInitialSave(
  args: InitialSaveArgs,
): InitialSaveReconciliation {
  const attemptedSerialized = serializeDraftInput(args.attemptedInput);
  const currentSerialized = serializeDraftInput(args.currentInput);
  const serverSerialized = serializeDraftInput(args.serverInput);

  if (currentSerialized === serverSerialized) {
    return {
      kind: "saved",
      input: args.serverInput,
      serialized: serverSerialized,
    };
  }
  if (args.acceptedInput && currentSerialized === attemptedSerialized) {
    return {
      kind: "saved",
      input: args.serverInput,
      serialized: serverSerialized,
    };
  }
  if (args.acceptedInput) {
    return { kind: "dirty", serialized: serverSerialized };
  }
  return { kind: "conflict", serialized: serverSerialized };
}

/**
 * Reactive queries may advance after another tab saves. A clean local form can
 * safely hydrate. A dirty form must keep both its text and its old compare-and-
 * swap token so it cannot overwrite the server update silently.
 */
export function reconcileDraftState(args: ReconcileArgs): DraftReconciliation {
  if (args.serverUpdatedAt <= args.localUpdatedAt) return { kind: "unchanged" };
  if (serializeDraftInput(args.localInput) !== args.lastSavedSerialized) {
    return { kind: "conflict" };
  }
  const serialized = serializeDraftInput(args.serverInput);
  return {
    kind: "hydrate",
    input: args.serverInput,
    updatedAt: args.serverUpdatedAt,
    serialized,
  };
}
