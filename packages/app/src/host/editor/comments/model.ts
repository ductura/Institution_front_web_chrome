// Pure rules of the Comments card (prototype comments2, WEB-2130, parity item 9). A comment is a
// record SEPARATE from the text; its places are anchors, never marks in the document. No server
// route exists yet: the port below is the smallest contract the plan implies, and a probe stands
// in for it in tests. Success is shown only from the server's answer (B-6). Nothing here makes a
// network call.
import { commentsHr as text } from "./messages.hr";

export type Role = "student" | "teacher" | "collaborator";
export type Kind = "must" | "sugg" | "q" | "praise";
export const KINDS: readonly Kind[] = ["must", "sugg", "q", "praise"];

export type Place = { readonly from: number; readonly to: number; readonly quote: string; readonly lost: boolean };
export type Reply = { readonly id: string; readonly role: Role; readonly text: string; readonly ts: number };
export type Comment = {
  readonly id: string;
  readonly role: Role; // author
  readonly kind: Kind | null; // null: the server gave no kind (older record)
  readonly text: string;
  readonly place: Place;
  readonly also: readonly Place[];
  readonly resolved: boolean;
  /** Mentor confirmation of a resolved "must" comment; null while none was given. */
  readonly confirmed: boolean | null;
  readonly round: number;
  readonly ts: number;
  readonly replies: readonly Reply[];
  readonly template: string | null;
};
export type Template = { readonly id: string; readonly text: string; readonly kind: Kind };

export type Read =
  | { readonly kind: "ready"; readonly comments: readonly Comment[]; readonly round: number; readonly templates: readonly Template[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type Write =
  | { readonly kind: "ok"; readonly comment: Comment }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };
export type TemplateWrite =
  | { readonly kind: "ok"; readonly templates: readonly Template[] }
  | { readonly kind: "signedOut" | "rejected" | "unknown" };

export type NewComment = { readonly text: string; readonly kind: Kind | null; readonly place: Place; readonly saveAsTemplate: boolean };
export interface CommentsPort {
  read(workId: string): Promise<Read>;
  create(workId: string, input: NewComment): Promise<Write>;
  reply(workId: string, commentId: string, body: string): Promise<Write>;
  setResolved(workId: string, commentId: string, resolved: boolean): Promise<Write>;
  confirm(workId: string, commentId: string): Promise<Write>;
  sendBack(workId: string, commentId: string, note: string): Promise<Write>;
  addPlace(workId: string, commentId: string, place: Place): Promise<Write>;
  saveTemplate(entry: { text: string; kind: Kind }): Promise<TemplateWrite>;
  deleteTemplate(id: string): Promise<TemplateWrite>;
}

export type Turn = "mentor" | "student";
export type TurnFilter = "mine" | "other" | "new" | null;

/** Only a "must" comment from the mentor asks for the mentor's confirmation; others close when resolved. */
export const needsConfirmation = (c: Comment): boolean => c.role === "teacher" && c.kind === "must";
export const isPraise = (c: Comment): boolean => c.kind === "praise";

/** Whose move it is; null when nobody has to act (praise, closed). */
export function turnOf(c: Comment): Turn | null {
  if (isPraise(c)) return null;
  if (c.resolved) return needsConfirmation(c) && c.confirmed === null ? "mentor" : null;
  const last = c.replies[c.replies.length - 1];
  return (last ? last.role : c.role) === "student" ? "mentor" : "student";
}
const mentorSide = (role: Role): boolean => role === "teacher";
export const isMine = (turn: Turn | null, viewer: Role): boolean =>
  turn !== null && (viewer === "teacher" ? turn === "mentor" : viewer === "student" && turn === "student");

/** New since the viewer last opened the card: someone else's comment or reply newer than `seen`. */
export function isNew(c: Comment, viewer: Role, seen: number): boolean {
  const other = (role: Role) => mentorSide(role) !== mentorSide(viewer);
  return (other(c.role) && c.ts > seen) || c.replies.some((r) => other(r.role) && r.ts > seen);
}

export type Counts = { readonly mine: number; readonly other: number; readonly fresh: number };
export function countsFor(list: readonly Comment[], viewer: Role, seen: number): Counts {
  const turns = list.map(turnOf);
  return {
    mine: turns.filter((t) => isMine(t, viewer)).length,
    other: turns.filter((t) => t !== null && !isMine(t, viewer)).length,
    fresh: list.filter((c) => isNew(c, viewer, seen)).length,
  };
}

/** The filter row shows from four comments, or while a filter is on, or when something is new. */
export const showFilters = (n: number, filter: TurnFilter, kind: Kind | null, fresh: number): boolean =>
  n >= 4 || filter !== null || kind !== null || fresh > 0;

/** Comments that pass the filters; the active one always stays so a click never makes it vanish. */
export function applyFilters(list: readonly Comment[], viewer: Role, seen: number, turn: TurnFilter, kind: Kind | null, keepId: string | null): readonly Comment[] {
  return list.filter((c) => {
    if (c.id === keepId) return true;
    if (kind && c.kind !== kind) return false;
    const t = turnOf(c);
    if (turn === "mine") return isMine(t, viewer);
    if (turn === "other") return t !== null && !isMine(t, viewer);
    if (turn === "new") return isNew(c, viewer, seen);
    return true;
  });
}

export function statusOf(c: Comment): string {
  if (isPraise(c)) return text.status.praise;
  if (!c.resolved) return text.status.open;
  if (!needsConfirmation(c)) return text.status.resolved;
  return c.confirmed ? text.status.confirmed : text.status.awaiting;
}
export function turnLabel(turn: Turn | null, viewer: Role): string | null {
  if (turn === null) return null;
  if (isMine(turn, viewer)) return text.turn.mine;
  return turn === "mentor" ? text.turn.waitMentor : text.turn.waitStudent;
}

/** What each role may do (INVENTAR §7 t. 5: the collaborator only reads and comments). */
export type Ability = { reply: boolean; resolve: boolean; reopen: boolean; confirm: boolean; quick: boolean; addPlace: boolean; templates: boolean; create: boolean };
export function abilities(c: Comment, viewer: Role, submitted: boolean): Ability {
  const none = { reply: false, resolve: false, reopen: false, confirm: false, quick: false, addPlace: false, templates: false, create: false };
  if (submitted) return none;
  const canWrite = viewer !== "collaborator";
  const praise = isPraise(c);
  return {
    reply: true,
    resolve: canWrite && !c.resolved && !praise,
    reopen: canWrite && c.resolved && !praise,
    confirm: viewer === "teacher" && c.resolved && needsConfirmation(c) && c.confirmed === null,
    quick: viewer === "student" && !c.resolved && c.role === "teacher" && !praise,
    addPlace: viewer === "teacher" && !c.resolved && c.role === "teacher",
    templates: viewer === "teacher",
    create: true,
  };
}

/** A reply or a new comment is sent trimmed, and only if something is left (1-2000 characters). */
export function bodyText(raw: string): string | null {
  const body = raw.trim();
  return body === "" || body.length > 2000 ? null : body;
}

export function quickReply(which: "clarify" | "disagree"): string {
  return text.quickPrefix[which];
}

/** A remembered text selection is good for two minutes and only inside one paragraph. */
export type Selection = { readonly from: number; readonly to: number; readonly quote: string; readonly at: number; readonly sameParagraph: boolean };
export function usableSelection(sel: Selection | null, now: number, docSize: number): Place | null {
  if (!sel || now - sel.at > 120000 || !sel.sameParagraph || sel.to > docSize || sel.to <= sel.from) return null;
  return { from: sel.from, to: sel.to, quote: sel.quote, lost: false };
}

/** Same remark given three or more times by the mentor, grouped by saved comment. */
export function repeated(list: readonly Comment[]): readonly { readonly key: string; readonly text: string; readonly open: number; readonly total: number }[] {
  const groups = new Map<string, Comment[]>();
  for (const c of list) {
    if (c.role !== "teacher" || isPraise(c) || c.template === null) continue;
    groups.set(c.template, [...(groups.get(c.template) ?? []), c]);
  }
  return [...groups].filter(([, l]) => l.length >= 3).map(([key, l]) => ({ key, text: l[0]!.text, open: l.filter((c) => !c.resolved).length, total: l.length }));
}

/** Rounds newest first with their comments; the current round is marked by the caller. */
export function byRound(list: readonly Comment[], current: number): readonly { readonly round: number; readonly current: boolean; readonly comments: readonly Comment[] }[] {
  const rows = [];
  for (let r = Math.max(current, 1); r >= 1; r--) rows.push({ round: r, current: r === current, comments: list.filter((c) => c.round === r) });
  return rows.filter((row) => row.comments.length > 0);
}

export const openForPrint = (list: readonly Comment[]): readonly Comment[] =>
  list.filter((c) => !c.resolved && !c.place.lost && !isPraise(c)).slice().sort((a, b) => a.place.from - b.place.from);
export function printText(list: readonly Comment[]): string {
  const rows = openForPrint(list).map((c, i) => `${i + 1}. „${c.place.quote}”${c.kind ? ` (${text.kinds[c.kind]})` : ""}\n   ${c.text}`);
  return `${text.printTitle}\n\n${rows.join("\n\n")}`;
}

/** Applies one server answer to the list: only an `ok` answer changes what is shown. */
export function withComment(list: readonly Comment[], answer: Write): readonly Comment[] {
  if (answer.kind !== "ok") return list;
  const known = list.some((c) => c.id === answer.comment.id);
  return known ? list.map((c) => (c.id === answer.comment.id ? answer.comment : c)) : [...list, answer.comment];
}
export function messageFor(kind: Write["kind"] | TemplateWrite["kind"], okText: string): string {
  if (kind === "ok") return okText;
  if (kind === "signedOut") return text.signedOut;
  return kind === "unknown" ? text.unknown : text.failed;
}

/** The server must repeat what was sent; an answer that does not is "unknown", never a success. */
export async function safely(call: () => Promise<Write>, matches: (c: Comment) => boolean): Promise<Write> {
  let answer: Write;
  try { answer = await call(); } catch { return { kind: "unknown" }; }
  return answer.kind === "ok" && !matches(answer.comment) ? { kind: "unknown" } : answer;
}
