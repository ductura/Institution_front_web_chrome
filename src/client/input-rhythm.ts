// Rhythm of entry and the kind of origin of an input (P-1, WEB-0910), behind a port.
// `createRhythmPort` is the real adapter over work.input-rhythm-setting.get, work.input-rhythm.post
// (PIL-P1-RITAM-EDITOR) and work.input-rhythm.delete (PIL-P1-RITAM-PREKIDAC); input-rhythm-fake.ts
// stays for tests and the demo.
//
// What is kept, by construction (P-1 rule 4, Constitution v1.7 to v1.9):
// - gaps in milliseconds between inputs inside one burst, nothing else: no key, no character,
//   no text, no count of keys, no speed, average, profile or comparison;
// - at most MAX_GAPS_PER_BURST gaps per burst, thinned evenly (never the first or last lost);
// - the start of a burst on the minute, never to the second.
// The recorder has no method that takes a key or text, so there is nothing to leave out.

import { createApi } from "./api";

/** The closed list of origins of a change (SRV-0910 a). Order is the display order. */
export const ORIGIN_KINDS = [
  "typed",
  "assistant_inserted",
  "assistant_match",
  "imported_file",
  "pasted_known",
  "pasted_unknown",
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

/** What a browser input reports about itself. Never the data of the input. */
export type InputKind = {
  /** `InputEvent.inputType`, e.g. `insertText`, `insertFromPaste`, `insertFromDrop`. */
  readonly inputType: string;
  /** The change comes from the assistant's insert action (the panel says so, not the DOM). */
  readonly fromAssistant?: boolean;
  /** The change comes from the import dialog (a file, never the clipboard). */
  readonly fromImport?: boolean;
};

/** One gap after another, thinned. A burst is the unit sent with a segment. */
export const MAX_GAPS_PER_BURST = 130;
/** A pause longer than this ends the burst. Assumption (P-1 gives none): 2 s, one constant. */
export const BURST_BREAK_MS = 2000;
/** A gap is never longer than the break, so a value cannot carry a long absence. */
export const MAX_GAP_MS = BURST_BREAK_MS;

export type RhythmBurst = {
  /** Start of the burst, rounded down to the minute (ms since the epoch). */
  readonly startedAtMinute: number;
  readonly gapsMs: readonly number[];
};

const MINUTE_MS = 60_000;

/**
 * The origin of one input, decided when it happens and never later (SRV-0910 a). A paste is
 * `pasted_unknown` until the student explains it (`explainPaste`); the original mark is kept
 * by the caller. Undo, redo and everything the DOM does not name are `null`: no kind is
 * guessed, so nothing is counted as typed that was not.
 */
export function originOfInput(input: InputKind): OriginKind | null {
  if (input.fromAssistant === true) return "assistant_inserted";
  if (input.fromImport === true) return "imported_file";
  switch (input.inputType) {
    case "insertText":
    case "insertCompositionText":
    case "insertLineBreak":
    case "insertParagraph":
      return "typed";
    case "insertFromPaste":
    case "insertFromPasteAsQuotation":
    case "insertFromDrop":
    case "insertFromYank":
      return "pasted_unknown";
    default:
      return null;
  }
}

/** The explained paste: `pasted_unknown` becomes `pasted_known`, any other kind stays. */
export function explainPaste(kind: OriginKind): OriginKind {
  return kind === "pasted_unknown" ? "pasted_known" : kind;
}

/** Thins to at most `max` values, evenly, keeping the first and the last. */
export function thinGaps(gaps: readonly number[], max: number = MAX_GAPS_PER_BURST): readonly number[] {
  if (gaps.length <= max) return gaps;
  if (max <= 1) return max === 1 ? [gaps[0]!] : [];
  const out: number[] = [];
  for (let i = 0; i < max; i += 1) out.push(gaps[Math.round((i * (gaps.length - 1)) / (max - 1))]!);
  return out;
}

export type RhythmRecorder = {
  /** One typed input happened. No argument: the recorder is never told which key. */
  noteTyped(): void;
  /** Any other change, or a pause the page knows about (blur, hidden): ends the burst. */
  breakBurst(): void;
  /** Hands over the closed bursts and the open one, and starts clean. */
  take(): readonly RhythmBurst[];
  /** The setting changed (the teacher's switch): off from now on, nothing earlier is touched. */
  setEnabled(enabled: boolean): void;
};

/**
 * The recorder. `now` is the clock; tests pass their own. With the setting off nothing is
 * measured and nothing is kept, and what was measured before stays only until `take`.
 */
export function createRhythmRecorder(now: () => number = () => Date.now(), enabled = true): RhythmRecorder {
  let on = enabled;
  let closed: RhythmBurst[] = [];
  let startedAt: number | null = null;
  let last = 0;
  let gaps: number[] = [];

  const close = () => {
    if (startedAt !== null && gaps.length > 0) {
      closed.push({ startedAtMinute: Math.floor(startedAt / MINUTE_MS) * MINUTE_MS, gapsMs: thinGaps(gaps) });
    }
    startedAt = null;
    gaps = [];
  };

  return {
    noteTyped() {
      if (!on) return;
      const t = now();
      if (startedAt === null) {
        startedAt = t;
      } else {
        const gap = t - last;
        if (gap > BURST_BREAK_MS || gap < 0) {
          close();
          startedAt = t;
        } else {
          gaps.push(Math.min(gap, MAX_GAP_MS));
        }
      }
      last = t;
    },
    breakBurst() {
      close();
    },
    take() {
      close();
      const out = closed;
      closed = [];
      return out;
    },
    setEnabled(next) {
      if (!next) close();
      on = next;
    },
  };
}

/** What goes with a segment: the origin of each change and the bursts, nothing else. */
export type RhythmPayload = {
  readonly origins: readonly { readonly kind: OriginKind; readonly codePoints: number }[];
  readonly bursts: readonly RhythmBurst[];
};

/** The level the setting of a work comes from (Daniel 23. 11. 2026.: per course, an assignment may override it). */
export type RhythmLevel = "assignment" | "course" | "default";

/** The setting of one work as the student sees it: never a switch, only what it is and who set it. */
export type RhythmSettingState = {
  readonly enabled: boolean;
  /** Null when the answer does not say and cannot be told from it (a dated change without `source`). */
  readonly level: RhythmLevel | null;
  readonly changedBy: { readonly role: "teacher" | "mentor"; readonly name: string | null } | null;
  readonly changedAt: string | null;
};
export type RhythmSettingAnswer =
  | { readonly kind: "ready"; readonly state: RhythmSettingState }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
/** "Obriši zabilježeni ritam": how many bursts the server deleted, never more than it confirmed. */
export type RhythmEraseAnswer =
  | { readonly kind: "deleted"; readonly count: number }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/**
 * The port of SRV-0910. The setting is the teacher's (per course, an assignment may override it):
 * only a teacher changes it, so there is no write method for it here. The student may read it and
 * delete what was recorded of their own work.
 */
export interface RhythmPort {
  /** True only when the server says exactly `enabled: true`; anything else, a failure included, is off. */
  recording(documentId: string): Promise<boolean>;
  setting(documentId: string): Promise<RhythmSettingAnswer>;
  erase(documentId: string): Promise<RhythmEraseAnswer>;
  send(documentId: string, payload: RhythmPayload): Promise<void>;
}

type Call = ReturnType<typeof createApi>;
type Result = { readonly ok: boolean; readonly status: number; readonly body?: unknown };

const LEVELS: readonly RhythmLevel[] = ["assignment", "course", "default"];
const UNAVAILABLE = { kind: "unavailable" } as const;

function refused(result: Result): { readonly kind: "signedOut" } | typeof UNAVAILABLE {
  return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
}

/**
 * The setting from an answer of work.input-rhythm-setting.get. The level is the server's `source`
 * when it names one (SRV #652); the extract of this route has none yet, so an undated answer is the
 * default and a dated one has no level the screen could claim.
 */
export function settingOf(result: Result): RhythmSettingAnswer {
  if (!result.ok) return refused(result);
  const body = result.body as { enabled?: unknown; source?: unknown; changedBy?: RhythmSettingState["changedBy"]; changedAt?: unknown } | undefined;
  if (typeof body?.enabled !== "boolean") return UNAVAILABLE;
  const changedAt = typeof body.changedAt === "string" ? body.changedAt : null;
  const named = LEVELS.find((level) => level === body.source);
  return {
    kind: "ready",
    state: { enabled: body.enabled, level: named ?? (changedAt === null ? "default" : null), changedBy: body.changedBy ?? null, changedAt },
  };
}

/**
 * The port over the server (SRV-0910 as merged). Nothing here throws: a failure is `unavailable`
 * (or `false` for `recording`), so nothing is recorded on doubt. `send` posts each burst on its
 * own as `{ gapsMs }`, the only field the route takes: the origins stay in the browser (the route
 * has none), and a failed send never reaches the writing or the save of the text.
 */
export function createRhythmPort(call: Call = createApi()): RhythmPort {
  const setting = async (documentId: string): Promise<RhythmSettingAnswer> => {
    try {
      return settingOf(await call("work.input-rhythm-setting.get", { params: { documentId }, query: undefined, body: undefined }));
    } catch {
      return UNAVAILABLE;
    }
  };
  return {
    setting,
    async recording(documentId) {
      const answer = await setting(documentId);
      return answer.kind === "ready" && answer.state.enabled === true;
    },
    async erase(documentId) {
      try {
        const result = await call("work.input-rhythm.delete", { params: { documentId }, query: undefined, body: undefined });
        if (!result.ok) return refused(result);
        const deleted = (result.body as { deleted?: unknown } | undefined)?.deleted;
        return typeof deleted === "number" && Number.isInteger(deleted) && deleted >= 0 ? { kind: "deleted", count: deleted } : UNAVAILABLE;
      } catch {
        return UNAVAILABLE;
      }
    },
    async send(documentId, payload) {
      for (const burst of payload.bursts) {
        if (burst.gapsMs.length === 0) continue;
        try {
          await call("work.input-rhythm.post", { params: { documentId }, query: undefined, body: { gapsMs: [...burst.gapsMs] } });
        } catch {
          // A later flush carries the next bursts; this one is not kept.
        }
      }
    },
  };
}
