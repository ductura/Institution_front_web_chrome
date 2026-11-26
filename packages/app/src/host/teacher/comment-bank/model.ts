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

export type BankKind = "must" | "sugg" | "q" | "praise";
export const BANK_KINDS: readonly BankKind[] = ["must", "sugg", "q", "praise"];

/** `title` is the kind's Croatian name; `label` is the teacher's own short label, or null. */
export type BankEntry = {
  readonly id: string; readonly kind: BankKind; readonly title: string; readonly label: string | null; readonly body: string;
};

/** What the teacher writes into the bank: the text, its kind and an optional label (1 to 40 characters). */
export type BankInput = { readonly text: string; readonly kind: BankKind; readonly label: string | null };

export const BANK_TEXT_MAX = 2000;
export const BANK_LABEL_MAX = 40;

/** A bank entry is saved only when the server named it (201 with an id); anything else leaves the list as it was. */
export type BankSave =
  | { readonly kind: "saved"; readonly entry: BankEntry }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

/** An entry is changed only when the server confirmed it (204). A 404 means the entry is no longer the teacher's to edit. */
export type BankUpdate =
  | { readonly kind: "updated"; readonly entry: BankEntry }
  | { readonly kind: "gone" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

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
  save(input: BankInput): Promise<BankSave>;
  update(entryId: string, input: BankInput): Promise<BankUpdate>;
}

/** The only comments a student is ever shown: drafts are filtered out here and nowhere else. */
export function visibleToStudent(comments: readonly WorkComment[]): readonly WorkComment[] {
  return comments.filter((comment) => comment.state === "published");
}

const fold = (value: string): string =>
  value.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/đ/g, "d");

/** Bank entries that match the kind (null = any) and hold every word of the query in the text, kind name or label; accents and case do not matter. */
export function searchBank(entries: readonly BankEntry[], query: string, kind: BankKind | null = null): readonly BankEntry[] {
  const words = fold(query).split(/\s+/).filter((word) => word !== "");
  return entries.filter((entry) => {
    if (kind !== null && entry.kind !== kind) return false;
    if (words.length === 0) return true;
    const haystack = fold(`${entry.title} ${entry.label ?? ""} ${entry.body}`);
    return words.every((word) => haystack.includes(word));
  });
}

const codePoints = (value: string): number => [...value].length;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export type BankInputError = "emptyText" | "textTooLong" | "labelTooLong" | "labelInvalid";

/**
 * The input as it is sent (NFC, empty label = none), or the reason it is not sent. The server holds
 * the same limits (text 1 to 2000 characters with a visible one, label 1 to 40 without control characters).
 */
export function normalizeBankInput(text: string, kind: BankKind, label: string): { ok: true; input: BankInput } | { ok: false; error: BankInputError } {
  const body = text.normalize("NFC");
  if (body.trim() === "") return { ok: false, error: "emptyText" };
  if (codePoints(body) > BANK_TEXT_MAX) return { ok: false, error: "textTooLong" };
  const shortLabel = label.normalize("NFC").trim();
  if (shortLabel === "") return { ok: true, input: { text: body, kind, label: null } };
  if (CONTROL.test(shortLabel)) return { ok: false, error: "labelInvalid" };
  if (codePoints(shortLabel) > BANK_LABEL_MAX) return { ok: false, error: "labelTooLong" };
  return { ok: true, input: { text: body, kind, label: shortLabel } };
}

/** Adds a bank entry text to the comment being written; a blank line separates it from what is there, and the limit is kept. */
export function insertIntoComment(current: string, inserted: string, limit: number): string {
  const joined = current.trim() === "" ? inserted : `${current.replace(/\s+$/, "")}\n\n${inserted}`;
  return [...joined].slice(0, limit).join("");
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

/**
 * The drafts to show after a publication, or null when the list shown stays as it is. Published:
 * none are left. Changed (409): nothing was published, so the list is read again from the server;
 * when that read fails the old list stays, with the message.
 */
export async function draftsAfterPublish(
  port: DraftCommentsPort, assignmentId: string, result: PublishResult,
): Promise<readonly WorkComment[] | null> {
  if (result.kind === "published") return [];
  if (result.kind !== "changed") return null;
  try {
    const read = await port.listDrafts(assignmentId);
    return read.kind === "ready" ? read.drafts : null;
  } catch {
    return null;
  }
}

/** Removes a bank entry; the caller drops it from the list only on "removed" (the server's answer). */
export async function removeBankEntry(port: CommentBankPort, entryId: string): Promise<BankRemove> {
  try {
    return await port.remove(entryId);
  } catch {
    return { kind: "unknown" };
  }
}

/** Saves a new bank entry; an invalid input is never sent. */
export async function saveBankEntry(port: CommentBankPort, input: BankInput): Promise<BankSave> {
  const checked = normalizeBankInput(input.text, input.kind, input.label ?? "");
  if (!checked.ok) return { kind: "rejected" };
  try {
    return await port.save(checked.input);
  } catch {
    return { kind: "unknown" };
  }
}

/** Changes a bank entry; an invalid input is never sent, and the list changes only on "updated". */
export async function updateBankEntry(port: CommentBankPort, entryId: string, input: BankInput): Promise<BankUpdate> {
  const checked = normalizeBankInput(input.text, input.kind, input.label ?? "");
  if (!checked.ok) return { kind: "rejected" };
  try {
    return await port.update(entryId, checked.input);
  } catch {
    return { kind: "unknown" };
  }
}

export function saveEntryMessage(result: BankSave): string {
  switch (result.kind) {
    case "saved": return text.entrySaved;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}

export function updateMessage(result: BankUpdate): string {
  switch (result.kind) {
    case "updated": return text.entryUpdated;
    case "gone": return text.entryGone;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
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
