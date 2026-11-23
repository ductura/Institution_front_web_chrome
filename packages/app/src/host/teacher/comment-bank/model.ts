// Pure rules of deferred comments and the comment bank (WEB-1704; plan M6.7, D-51, N-03).
// The teacher saves comments as drafts and publishes a group. A draft is the teacher's alone:
// nothing here lets a draft reach the student's list. A publication counts as recorded only when
// the answer names exactly the drafts that were sent (B-6). The real ports (port.ts) call the
// generated client; the fake ports stay for tests.
// This module makes no network call; the page that mounts it passes the real ports.
import { commentBankMessages as text } from "./messages.hr";

export type CommentState = "draft" | "published";

export type WorkComment = {
  readonly id: string;
  readonly body: string;
  readonly state: CommentState;
  readonly savedAt: string;
};

export type BankEntry = { readonly id: string; readonly title: string; readonly body: string };

/** Where in the text a new draft is anchored; the server takes no draft without one. */
export type DraftAnchor = {
  readonly nodeId: string; readonly quote: string; readonly prefix: string; readonly suffix: string;
  readonly startHint: number; readonly endHint: number;
};

/** A bank entry is removed only when the server confirmed it (204); anything else leaves it listed. */
export type BankRemove =
  | { readonly kind: "removed" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

export type DraftsRead =
  | { readonly kind: "ready"; readonly drafts: readonly WorkComment[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type DraftSave =
  | { readonly kind: "saved"; readonly draft: WorkComment }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

export type PublishResult =
  | { readonly kind: "published"; readonly ids: readonly string[] }
  /** The server's drafts differ from the ones sent: nothing was published, the list is read again. */
  | { readonly kind: "changed" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

export type BankRead =
  | { readonly kind: "ready"; readonly entries: readonly BankEntry[] }
  | { readonly kind: "unavailable" };

export interface DraftCommentsPort {
  listDrafts(assignmentId: string): Promise<DraftsRead>;
  saveDraft(assignmentId: string, body: string, anchor?: DraftAnchor): Promise<DraftSave>;
  /** Publishes the named drafts as one group; the answer names what was published. */
  publishDrafts(assignmentId: string, ids: readonly string[]): Promise<PublishResult>;
}

export interface CommentBankPort {
  read(): Promise<BankRead>;
  remove(entryId: string): Promise<BankRemove>;
}

/** The only comments a student is ever shown: drafts are filtered out here and nowhere else. */
export function visibleToStudent(comments: readonly WorkComment[]): readonly WorkComment[] {
  return comments.filter((comment) => comment.state === "published");
}

const fold = (value: string): string =>
  value.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/đ/g, "d");

/** Bank entries whose title or text holds every word of the query; accents and case do not matter. */
export function searchBank(entries: readonly BankEntry[], query: string): readonly BankEntry[] {
  const words = fold(query).split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = fold(`${entry.title} ${entry.body}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Saves a draft; an empty text is never sent, and an answer that does not repeat the text is unknown. */
export async function saveDraftComment(
  port: DraftCommentsPort, assignmentId: string, body: string, anchor?: DraftAnchor,
): Promise<DraftSave> {
  if (body.trim() === "") return { kind: "rejected" };
  let result: DraftSave;
  try {
    result = await port.saveDraft(assignmentId, body, anchor);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "saved" && (result.draft.body !== body || result.draft.state !== "draft")) return { kind: "unknown" };
  return result;
}

/** Publishes a group; recorded only when the answer names exactly the drafts sent. */
export async function publishDraftGroup(
  port: DraftCommentsPort,
  assignmentId: string,
  ids: readonly string[],
): Promise<PublishResult> {
  if (ids.length === 0) return { kind: "rejected" };
  let result: PublishResult;
  try {
    result = await port.publishDrafts(assignmentId, ids);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "published") {
    const same = result.ids.length === ids.length && ids.every((id) => result.ids.includes(id));
    if (!same) return { kind: "unknown" };
  }
  return result;
}

/** Removes a bank entry; the caller drops it from the list only on "removed" (the server's answer). */
export async function removeBankEntry(port: CommentBankPort, entryId: string): Promise<BankRemove> {
  try {
    return await port.remove(entryId);
  } catch {
    return { kind: "unknown" };
  }
}

export function removeMessage(result: BankRemove): string {
  switch (result.kind) {
    case "removed": return text.removed;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}

export function draftMessage(result: DraftSave): string {
  switch (result.kind) {
    case "saved": return text.draftSaved;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}

export function publishMessage(result: PublishResult): string {
  switch (result.kind) {
    case "published": return text.published;
    case "changed": return text.draftsChanged;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}
