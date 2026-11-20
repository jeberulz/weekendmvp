import type { ErrorSource, FeedbackSurface, StepState } from "./contracts";

/** The admin page's projection of a `feedback_entries` row. */
export type FeedbackRow = {
  readonly id: string;
  readonly ownerId: string;
  readonly projectId: string | null;
  readonly surface: FeedbackSurface;
  readonly note: string;
  readonly rating: number | null;
  readonly route: string;
  readonly stepStates: StepState[];
  readonly buildVersion: string;
  readonly createdAt: number;
};

/** The admin page's projection of a `client_errors` row. */
export type ErrorRow = {
  readonly id: string;
  readonly ownerId: string;
  readonly projectId: string | null;
  readonly source: ErrorSource;
  readonly errorClass: string;
  readonly route: string;
  readonly buildVersion: string;
  readonly createdAt: number;
};

export type CountBy = { readonly key: string; readonly count: number };

/** Counts over a bounded window; `truncated` says the window held more rows than were read. */
export type FeedbackOverview = {
  readonly feedback: {
    readonly count: number;
    readonly ratingAverage: number | null;
    /** Index 0 is one star, index 4 is five. */
    readonly ratingCounts: number[];
    readonly unrated: number;
    readonly truncated: boolean;
  };
  readonly errors: {
    readonly count: number;
    readonly byClass: CountBy[];
    readonly byRoute: CountBy[];
    readonly bySource: CountBy[];
    readonly truncated: boolean;
  };
};

export type Page<T> = { readonly page: readonly T[]; readonly isDone: boolean; readonly continueCursor: string | null };
