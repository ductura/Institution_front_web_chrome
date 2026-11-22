// Pure rules of N-07 "Što je student predao" (WEB-2155, PARITET N-07 br. 15): which variant the reads give,
// the title, the rows of the receipt with Zagreb times "(UTC+n)", the exact UTC values, the fingerprint in
// groups of four, the link to the public check and the QR sample. Only what the server states (B-6): a fact
// the routes do not give (task kind, earlier versions sent for review, due date of a pending receipt) is left
// out, never invented. No network call here.
import type { SubmissionState } from "@/client/submission";
import { readVerificationFields } from "@/components/public-verification/code";
import { zagrebEpochMs, zagrebWall } from "@/lib/i18n/zagreb";

import { VERIFY_PATH } from "../../public/verify/model";
import { stateLine, type ServerState } from "../n06/model";
import { n07Messages as text } from "./messages.hr";

/** What the page has read: null while reading, else the outcome of readTeacherWorkReceipt. */
export type ReceiptInput =
  | null
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" }
  | {
    readonly kind: "ready"; readonly state: ServerState; readonly studentName: string | null;
    readonly submission: SubmissionState;
  };

export type Row = { readonly id: string; readonly label: string; readonly value: string };

export type ReceiptView =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "notFound" }
  | { readonly kind: "notSubmitted"; readonly body: string }
  | { readonly kind: "pending"; readonly title: string; readonly body: string; readonly rows: readonly Row[] }
  | {
    readonly kind: "submitted"; readonly title: string; readonly rows: readonly Row[]; readonly utc: readonly Row[];
    readonly fingerprint: string; readonly groups: string; readonly record: string;
    /** The public check with this receipt filled in, or null when the receipt's ids cannot be read as a code. */
    readonly verifyPath: string | null;
  };

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** The prototype's `fmt`: "5. 11. 2026. u 21:14", in Zagreb time; the input as given when it is no instant. */
export function shortTime(iso: string): string {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return iso;
  const w = zagrebWall(ms);
  return `${w.day}. ${w.month}. ${w.year}. u ${two(w.hour)}:${two(w.minute)}`;
}

/** The prototype's `zoned`: the short time and the Zagreb offset of that instant, "(UTC+1)" or "(UTC+2)". */
export function zonedTime(iso: string): string {
  const ms = zagrebEpochMs(iso);
  if (ms === null) return iso;
  const w = zagrebWall(ms);
  const offset = Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - ms) / 3_600_000);
  return `${shortTime(iso)} (UTC+${offset})`;
}

/** 64 hex characters in sixteen groups of four, as the prototype shows the fingerprint. */
export const groupsOfFour = (hex: string): string => (hex.match(/.{1,4}/g) ?? []).join(" ");

/** The path of the public check (C-6) with the receipt's code in the fragment, which never reaches a server log. */
export function verifyPath(submissionId: string, sha256: string): string | null {
  const code = readVerificationFields({ receiptId: submissionId, fingerprint: sha256 });
  return code === null ? null : `${VERIFY_PATH}#r=${code.receiptId}&o=${code.fingerprint}`;
}

export function receiptView(input: ReceiptInput): ReceiptView {
  if (input === null || input.kind === "signedOut") return { kind: "loading" };
  if (input.kind === "notFound") return { kind: "notFound" };
  if (input.kind === "unavailable") return { kind: "error" };
  const { submission, state } = input;
  if (submission.kind === "none") {
    // A work the server calls submitted without a receipt contradicts itself: an error, never "nije predano".
    if (state !== "nije_predano") return { kind: "error" };
    const line = stateLine({ studentName: input.studentName, assignmentId: "", state, previousId: null, nextId: null, receipt: null });
    return { kind: "notSubmitted", body: text.notSubmitted(line) };
  }
  if (submission.kind === "ceka") {
    return {
      kind: "pending", title: text.pendingTitle, body: text.pendingBody(shortTime(submission.requestedAt)),
      rows: [
        { id: "requested", label: text.submittedAt, value: zonedTime(submission.requestedAt) },
        { id: "signed", label: text.signingStarted, value: text.notYetRecorded },
      ],
    };
  }
  const p = submission.receipt.payload;
  return {
    kind: "submitted",
    title: text.submittedTitle(shortTime(p.requestedAt), p.afterDeadline),
    rows: [
      { id: "requested", label: text.submittedAt, value: zonedTime(p.requestedAt) },
      { id: "due", label: text.dueAt, value: zonedTime(p.dueAt) },
      { id: "signed", label: text.signingStarted, value: zonedTime(p.signedAt) },
      { id: "version", label: text.version, value: text.versionValue(p.revision) },
    ],
    utc: [
      { id: "requestedAt", label: "requestedAt", value: p.requestedAt },
      { id: "dueAt", label: "dueAt", value: p.dueAt },
      { id: "signedAt", label: "signedAt", value: p.signedAt },
    ],
    fingerprint: p.artifactSha256,
    groups: groupsOfFour(p.artifactSha256),
    record: text.records[p.evidenceRecord],
    verifyPath: verifyPath(p.submissionId, p.artifactSha256),
  };
}

/** The receipt kind the "zamjenski postupak" panel (WEB-2156) keys on. */
export function fallbackKey(view: ReceiptView): "potvrdeno" | "ceka" | "error" | "loading" | "none" {
  if (view.kind === "submitted") return "potvrdeno";
  if (view.kind === "pending") return "ceka";
  if (view.kind === "notSubmitted") return "none";
  return view.kind === "loading" ? "loading" : "error";
}

/** True when the work is submitted as the server states it: only then the "Prije predaje" panel is read. */
export const isSubmittedRead = (input: ReceiptInput): boolean => input?.kind === "ready" && input.state !== "nije_predano";

const QR_SIZE = 21;
const inFinder = (x: number, y: number): boolean =>
  (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);

/**
 * The prototype's `qr()`: a 21×21 pattern derived from the fingerprint, as an SVG path of the data cells.
 * A sample without content (prototype: the real QR code is in the record the student downloaded).
 */
export function qrCells(hex: string): string {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return "";
  let cells = "";
  let bit = 0;
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (inFinder(x, y)) continue;
      const v = (parseInt(hex[bit % 64]!, 16) >> (bit % 4)) & 1;
      bit += 3;
      if (v ^ ((x * y + x) % 3 === 0 ? 1 : 0)) cells += `M${x} ${y}h1v1h-1z`;
    }
  }
  return cells;
}
