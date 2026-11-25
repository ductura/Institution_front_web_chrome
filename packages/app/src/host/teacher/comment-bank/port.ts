// The real ports of deferred comments and the comment bank (WEB-1704): the generated client of
// src/client (createApi over the contract extract), never a network call of their own. Publishing
// sends exactly the drafts the teacher saw (work.comments.publish-selected.post); the server
// publishes them all or none and answers only with a count, so a group counts as published (B-6)
// only when that count equals the number of drafts that were sent. A 409 means the server's drafts
// differ from the ones sent: nothing was published and the list has to be read again.
import { createApi } from "../../../../../../src/client/api.ts";

import { commentBankMessages as text } from "./messages.hr";
import type {
  BankEntry, BankInput, BankRead, BankRemove, BankSave, BankUpdate, CommentBankPort, DraftAnchor, DraftCommentsPort, DraftSave, DraftsRead,
  PublishResult, WorkComment,
} from "./model";

type Call = ReturnType<typeof createApi>;
type Draft = { threadId: string; commentId: string; text: string; createdWindow: string };

const toDraft = (draft: Draft): WorkComment =>
  ({ id: draft.commentId, body: draft.text, state: "draft", savedAt: draft.createdWindow });

async function readDrafts(documentId: string, call: Call): Promise<{ kind: "ok"; drafts: Draft[] } | { kind: "signedOut" | "unavailable" }> {
  try {
    const answer = await call("work.comment-drafts.get", { params: { documentId }, query: undefined, body: undefined });
    if (answer.ok) return { kind: "ok", drafts: answer.body.drafts };
    return { kind: answer.status === 401 ? "signedOut" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export function draftCommentsPortFor(call: () => Call = () => createApi()): DraftCommentsPort {
  return {
    async listDrafts(documentId): Promise<DraftsRead> {
      const read = await readDrafts(documentId, call());
      return read.kind === "ok" ? { kind: "ready", drafts: read.drafts.map(toDraft) } : read;
    },
    async saveDraft(documentId, body, anchor?: DraftAnchor): Promise<DraftSave> {
      if (anchor === undefined) return { kind: "rejected" };
      const api = call();
      try {
        const answer = await api("work.comment-drafts.post", { params: { documentId }, query: undefined, body: { text: body, anchor } });
        if (!answer.ok) {
          if (answer.status === 401) return { kind: "signedOut" };
          return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
        }
        // The server names the new thread or comment; the draft shown is the one it holds.
        const answered = answer.body;
        const read = await readDrafts(documentId, api);
        if (read.kind !== "ok") return { kind: "unknown" };
        const found = read.drafts.find((draft) =>
          ("commentId" in answered ? draft.commentId === answered.commentId : draft.threadId === answered.threadId) && draft.text === body);
        return found ? { kind: "saved", draft: toDraft(found) } : { kind: "unknown" };
      } catch {
        return { kind: "unknown" };
      }
    },
    async publishDrafts(documentId, ids): Promise<PublishResult> {
      try {
        const answer = await call()("work.comments.publish-selected.post", { params: { documentId }, query: undefined, body: { draftIds: [...ids] } });
        if (answer.ok) return answer.body.published === ids.length ? { kind: "published", ids } : { kind: "unknown" };
        if (answer.status === 401) return { kind: "signedOut" };
        if (answer.status === 409) return { kind: "changed" };
        return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
      } catch {
        return { kind: "unknown" };
      }
    },
  };
}

const entryOf = (id: string, input: BankInput): BankEntry =>
  ({ id, kind: input.kind, title: text.kinds[input.kind], label: input.label, body: input.text });

export function commentBankPortFor(call: () => Call = () => createApi()): CommentBankPort {
  return {
    async read(): Promise<BankRead> {
      try {
        const answer = await call()("teacher.comment-bank.get", { params: undefined, query: undefined, body: undefined });
        if (!answer.ok) return { kind: "unavailable" };
        const entries: BankEntry[] = answer.body.entries.map((entry) => ({
          id: entry.id, kind: entry.kind, title: text.kinds[entry.kind], label: entry.label ?? null, body: entry.text,
        }));
        return { kind: "ready", entries };
      } catch {
        return { kind: "unavailable" };
      }
    },
    async remove(entryId): Promise<BankRemove> {
      try {
        const answer = await call()("teacher.comment-bank.delete", { params: { entryId }, query: undefined, body: undefined });
        if (answer.ok) return { kind: "removed" };
        if (answer.status === 401) return { kind: "signedOut" };
        return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
      } catch {
        return { kind: "unknown" };
      }
    },
    async save(input: BankInput): Promise<BankSave> {
      try {
        const answer = await call()("teacher.comment-bank.post", { params: undefined, query: undefined, body: { text: input.text, kind: input.kind, label: input.label } });
        if (!answer.ok) {
          if (answer.status === 401) return { kind: "signedOut" };
          return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
        }
        // The entry shown is the one the server named, with exactly what was sent.
        if (typeof answer.body?.id !== "string") return { kind: "unknown" };
        return { kind: "saved", entry: entryOf(answer.body.id, input) };
      } catch {
        return { kind: "unknown" };
      }
    },
    async update(entryId, input: BankInput): Promise<BankUpdate> {
      try {
        const answer = await call()("teacher.comment-bank-entry.put", { params: { entryId }, query: undefined, body: { text: input.text, kind: input.kind, label: input.label } });
        if (answer.ok) return { kind: "updated", entry: entryOf(entryId, input) };
        if (answer.status === 401) return { kind: "signedOut" };
        // Another teacher's entry and a missing one answer alike (404): it is not there for this teacher.
        if (answer.status === 404) return { kind: "gone" };
        return answer.status >= 400 && answer.status < 500 ? { kind: "rejected" } : { kind: "unknown" };
      } catch {
        return { kind: "unknown" };
      }
    },
  };
}

export const draftCommentsPort: DraftCommentsPort = draftCommentsPortFor();
export const commentBankPort: CommentBankPort = commentBankPortFor();
