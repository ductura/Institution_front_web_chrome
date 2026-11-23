// In-memory stand-in for the draft-comment route (WEB-1704). It holds one list per work, as the
// server would, and gives the student's side only what was published.
import { visibleToStudent, type BankEntry, type CommentBankPort, type DraftCommentsPort, type WorkComment } from "./model";

export const FAKE_BANK: readonly BankEntry[] = [
  { id: "b1", title: "Izvor", body: "Navedite izvor ove tvrdnje." },
  { id: "b2", title: "Struktura", body: "Odlomak bi bio jasniji uz uvodnu rečenicu." },
  { id: "b3", title: "Zaključak", body: "Zaključak treba odgovoriti na postavljeno pitanje." },
];

export function fakeCommentBankPort(entries: readonly BankEntry[] = FAKE_BANK): CommentBankPort {
  let held = entries;
  return {
    read: async () => ({ kind: "ready", entries: held }),
    async remove(entryId) {
      held = held.filter((entry) => entry.id !== entryId);
      return { kind: "removed" };
    },
  };
}

export function fakeDraftCommentsPort(): DraftCommentsPort & {
  readonly all: () => readonly WorkComment[];
  readonly studentView: () => readonly WorkComment[];
} {
  let comments: WorkComment[] = [];
  let next = 1;
  return {
    all: () => comments,
    studentView: () => visibleToStudent(comments),
    async listDrafts() {
      return { kind: "ready", drafts: comments.filter((comment) => comment.state === "draft") };
    },
    async saveDraft(_id, body) {
      const draft: WorkComment = { id: `d${next++}`, body, state: "draft", savedAt: "2026-11-21T10:00:00.000Z" };
      comments = [...comments, draft];
      return { kind: "saved", draft };
    },
    async publishDrafts(_id, ids) {
      const known = ids.filter((id) => comments.some((comment) => comment.id === id && comment.state === "draft"));
      comments = comments.map((comment) => (known.includes(comment.id) ? { ...comment, state: "published" } : comment));
      return { kind: "published", ids: known };
    },
  };
}
