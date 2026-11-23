// "Podrijetlo teksta" (WEB-0911; P-1; N-10): the closed list of origin kinds and the composition one screen
// renders. Moved here from the unmounted teacher/origin-map (PIL-P1-PODUDARANJE-KARTA); the student's page and
// N-10 read it from here. The server answer (work.origin-composition.get) is turned into it by the reader of
// each screen; nothing in this file calls the server.

/** The closed list of origin kinds (P-1 rule 1 and 8), in the order the screen shows them. */
export const ORIGIN_KINDS = [
  "typed", "assistant_inserted", "assistant_match", "imported_file", "pasted_known", "pasted_unknown",
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

export type OriginShare = { readonly kind: OriginKind; readonly codePoints: number; readonly percent: number };
export type OriginSegment = {
  readonly id: string;
  readonly text: string;
  readonly kind: OriginKind;
  /** Minute of entry, ISO time. */
  readonly at: string;
  /** Gaps in ms between inputs inside a burst (P-1 rule 4). Absent when the rhythm is off or not recorded. */
  readonly gapsMs?: readonly number[];
};
export type OriginComposition = {
  readonly totalCodePoints: number;
  readonly shares: readonly OriginShare[];
  readonly segments: readonly OriginSegment[];
  /** False: the teacher switched the rhythm off; no rhythm is shown, also not in the replay. */
  readonly rhythmRecorded: boolean;
};

export type OriginRead =
  | { readonly kind: "ready"; readonly composition: OriginComposition }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };
