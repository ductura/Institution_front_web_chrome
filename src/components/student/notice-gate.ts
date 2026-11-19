// F-7 (#336, C-3): the student's acknowledgment of the S3 notice is the only
// request the notice screen makes, and only after an explicit confirmation
// of a ticked box. Until the server returns its time, `mayRecord` is false:
// no evidence for this assignment may leave the browser before it.
//
// DAN-306 (#1502 B1): the request carries the fingerprint of the notice this
// screen showed, computed here with the template version of this bundle. The
// server records the acknowledgment only if its own fingerprint of the
// stored version is the same, so a student never confirms a text they did
// not see.
import { createApi } from "@/client/api";

import { NOTICE_TEMPLATE_VERSION, noticeFingerprint, type NoticeFingerprintInput } from "./obavijest/notice-fingerprint";

export type AckError = "stale" | "unauthorized" | "forbidden" | "invalid" | "unavailable";

export type Acknowledgment = { kind: "acknowledged"; at: string } | { kind: AckError };

export type NoticeState =
  | { phase: "reading"; checked: boolean; error?: AckError }
  | { phase: "sending" }
  | { phase: "acknowledged"; at: string };

export type NoticeEvent =
  | { type: "toggle" }
  | { type: "confirm" }
  | { type: "settled"; result: Acknowledgment };

/** The next state, and whether this step sends the acknowledgment. */
export function noticeStep(state: NoticeState, event: NoticeEvent): { state: NoticeState; send: boolean } {
  if (state.phase === "reading" && event.type === "toggle") {
    return { state: { phase: "reading", checked: !state.checked }, send: false };
  }
  if (state.phase === "reading" && event.type === "confirm" && state.checked) {
    return { state: { phase: "sending" }, send: true };
  }
  if (state.phase === "sending" && event.type === "settled") {
    const { result } = event;
    return result.kind === "acknowledged"
      ? { state: { phase: "acknowledged", at: result.at }, send: false }
      : { state: { phase: "reading", checked: true, error: result.kind }, send: false };
  }
  return { state, send: false };
}

export function initialNotice(acknowledgedAt: string | null): NoticeState {
  return acknowledgedAt ? { phase: "acknowledged", at: acknowledgedAt } : { phase: "reading", checked: false };
}

/** The gate for any evidence transport of this assignment. */
export function mayRecord(state: NoticeState): boolean {
  return state.phase === "acknowledged";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Api = ReturnType<typeof createApi>;

// The contract checks the shape; Date.parse would still roll 2026-02-31 over into March.
function isInstant(value: string): boolean {
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value;
}

/** The notice as the screen shows it: the version and every field that enters its fingerprint. */
export type ShownNotice = Omit<NoticeFingerprintInput, "templateVersion"> & { assignmentId: string; versionNo: number };

/**
 * WEB-12: the acknowledgment goes through createApi on
 * institution.acknowledgment.post, so the answer is checked against the
 * contract (a 200 without an exact server time is `unexpected`). Both answers
 * 409 (another version, or the notice changed under the same version) are
 * `stale`: either way the screen holds an old text.
 */
export async function acknowledgeNotice(notice: ShownNotice, api: Api = createApi()): Promise<Acknowledgment> {
  const { assignmentId, versionNo } = notice;
  if (!UUID.test(assignmentId) || !Number.isInteger(versionNo) || versionNo < 1) return { kind: "invalid" };
  let fingerprint: string;
  try {
    // Only the fields of the fingerprint, so that nothing else of the view
    // can change it. Without Web Crypto it fails and nothing is sent.
    fingerprint = await noticeFingerprint({
      templateVersion: NOTICE_TEMPLATE_VERSION,
      title: notice.title,
      instructions: notice.instructions,
      workType: notice.workType,
      opensAt: notice.opensAt,
      dueAt: notice.dueAt,
      aiPolicy: notice.aiPolicy,
      aiPurposes: notice.aiPurposes,
      evidenceProfile: notice.evidenceProfile,
      wordMin: notice.wordMin,
      wordMax: notice.wordMax,
    });
  } catch {
    return { kind: "unavailable" };
  }
  let result: Awaited<ReturnType<Api>>;
  try {
    result = await api("institution.acknowledgment.post", {
      params: { assignmentId }, query: undefined, body: { versionNo, fingerprint },
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (result.ok) {
    const at = (result.body as { acknowledgedAt: string }).acknowledgedAt;
    return isInstant(at) ? { kind: "acknowledged", at } : { kind: "unavailable" };
  }
  if (result.status === 401) return { kind: "unauthorized" };
  if (result.status === 403) return { kind: "forbidden" };
  if (result.status === 409) return { kind: "stale" };
  if (result.code === "client_rejected" || [400, 408, 413, 415, 422].includes(result.status)) return { kind: "invalid" };
  return { kind: "unavailable" };
}
