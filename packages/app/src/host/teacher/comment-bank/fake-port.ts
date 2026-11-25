// In-memory stand-in for the draft-comment route (WEB-1704). It holds one list per work, as the
// server would, and gives the student's side only what was published.
import { visibleToStudent, type BankEntry, type BankInput, type CommentBankPort, type DraftCommentsPort, type WorkComment } from "./model";

export const FAKE_BANK: readonly BankEntry[] = [
  { id: "b1", kind: "must", title: "Obavezno", label: "Izvor", body: "Navedite izvor ove tvrdnje." },
  { id: "b2", kind: "sugg", title: "Prijedlog", label: "Struktura", body: "Odlomak bi bio jasniji uz uvodnu rečenicu." },
  { id: "b3", kind: "q", title: "Pitanje", label: null, body: "Odgovara li zaključak na postavljeno pitanje?" },
];

export function fakeCommentBankPort(entries: readonly BankEntry[] = FAKE_BANK): CommentBankPort {
  let held = entries;
  let next = 1;
  const kinds = { must: "Obavezno", sugg: "Prijedlog", q: "Pitanje", praise: "Pohvala" } as const;
  const entryOf = (id: string, input: BankInput): BankEntry =>
    ({ id, kind: input.kind, title: kinds[input.kind], label: input.label, body: input.text });
  return {
    read: async () => ({ kind: "ready", entries: held }),
    async remove(entryId) {
      held = held.filter((entry) => entry.id !== entryId);
      return { kind: "removed" };
    },
    async save(input) {
      const entry = entryOf(`n${next++}`, input);
      held = [...held, entry];
      return { kind: "saved", entry };
    },
    async update(entryId, input) {
      if (!held.some((entry) => entry.id === entryId)) return { kind: "gone" };
      const entry = entryOf(entryId, input);
      held = held.map((existing) => (existing.id === entryId ? entry : existing));
      return { kind: "updated", entry };
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
