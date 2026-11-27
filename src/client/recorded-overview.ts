// Read-only overview for the dialog "Što Ductura bilježi dok pišeš" (F4-EDI-R06): the student's
// conversations with the assistant, the transfers into the work (import, paste) and, when the
// contract gives a way to list them, the attachments. Only existing routes of the contract extract:
// student.assistant-conversations.get (per assignment) and work.origin-composition.get (per work).
// There is no route that lists the attachments of a work (work.attachments.get reads one by id),
// so the screen says that honestly instead of guessing a number.
//
// What the screen may claim, by construction:
// - 401 is `signedOut`; every other refusal (404 and 403 included) is the same `unavailable`, so the
//   screen never says whether a work or an assignment exists;
// - a thrown call or an answer of an unexpected shape is `unavailable`, never an empty overview.
import { createApi, type ApiResult } from "./api";
import type { OriginKind } from "./input-rhythm";

type Call = ReturnType<typeof createApi>;

/** The origins that are a transfer into the work, in display order. */
export const TRANSFER_KINDS = ["imported_file", "pasted_known", "pasted_unknown"] as const satisfies readonly OriginKind[];
export type TransferKind = (typeof TRANSFER_KINDS)[number];

export type Transfers = readonly { readonly kind: TransferKind; readonly percent: number }[];
export type ConversationsSummary = { readonly conversations: number; readonly requests: number; readonly lastActivityAt: string | null };

export type Answer<T> = { readonly kind: "ready"; readonly value: T } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

export interface RecordedPort {
  transfers(documentId: string): Promise<Answer<Transfers>>;
  conversations(assignmentId: string): Promise<Answer<ConversationsSummary>>;
}

const UNAVAILABLE = { kind: "unavailable" } as const;

function failed(result: { readonly ok: false; readonly status: number }): Answer<never> {
  return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
}

function transfersOf(result: ApiResult<"work.origin-composition.get">): Answer<Transfers> {
  if (!result.ok) return failed(result);
  const parts: unknown = result.body.parts;
  if (!Array.isArray(parts)) return UNAVAILABLE;
  const out: { kind: TransferKind; percent: number }[] = [];
  for (const kind of TRANSFER_KINDS) {
    const part = parts.find((p: { kind?: unknown }) => p.kind === kind) as { percent?: unknown } | undefined;
    if (part === undefined || typeof part.percent !== "number" || !Number.isFinite(part.percent)) return UNAVAILABLE;
    out.push({ kind, percent: part.percent });
  }
  return { kind: "ready", value: out };
}

function conversationsOf(result: ApiResult<"student.assistant-conversations.get">): Answer<ConversationsSummary> {
  if (!result.ok) return failed(result);
  const list: unknown = result.body.conversations;
  if (!Array.isArray(list)) return UNAVAILABLE;
  let requests = 0;
  let last: string | null = null;
  for (const c of list as { requestCount?: unknown; lastActivityAt?: unknown }[]) {
    if (typeof c.requestCount !== "number" || typeof c.lastActivityAt !== "string") return UNAVAILABLE;
    requests += c.requestCount;
    if (last === null || c.lastActivityAt > last) last = c.lastActivityAt;
  }
  return { kind: "ready", value: { conversations: list.length, requests, lastActivityAt: last } };
}

export function createRecordedPort(call: Call = createApi()): RecordedPort {
  return {
    async transfers(documentId) {
      try {
        return transfersOf(await call("work.origin-composition.get", { params: { documentId }, query: undefined, body: undefined }));
      } catch {
        return UNAVAILABLE;
      }
    },
    async conversations(assignmentId) {
      try {
        return conversationsOf(await call("student.assistant-conversations.get", { params: { assignmentId }, query: undefined, body: undefined }));
      } catch {
        return UNAVAILABLE;
      }
    },
  };
}
