// WEB-2128: what the student keeps beside the work for the writing help: the
// question of the work, chosen roles, own chapter goals, plans, tasks, the
// place where they stopped and a message to themselves. It is the student's
// alone: it never enters the document, the export or a submission. Keyed by
// work id and heading block id, in the browser, like the notes of the Draft
// panel. No server route exists for it (open item in the PR).
import { isRole, type Roles } from "./advice";
import type { RoleKey } from "./messages.hr";

export type NoteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const LIMITS = { thesis: 600, line: 160, plan: 12, todos: 30, note: 400 } as const;

export type Todo = { readonly id: string; readonly text: string; readonly done: boolean };

export type WorkNotes = {
  readonly thesis: string;
  readonly roles: Roles;
  readonly targets: Readonly<Record<string, number>>;
  readonly plans: Readonly<Record<string, readonly string[]>>;
  readonly todos: Readonly<Record<string, readonly Todo[]>>;
  readonly lastChapterId: string | null;
  readonly selfNote: string;
};

export const EMPTY_NOTES: WorkNotes = { thesis: "", roles: {}, targets: {}, plans: {}, todos: {}, lastChapterId: null, selfNote: "" };

export const notesKey = (workId: string) => `ductura.writing-help.${workId}`;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu;
export const clean = (text: string, max: number) => text.replace(CONTROL, "").slice(0, max);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Anything malformed is dropped field by field; a broken store never breaks the editor. */
export function parseNotes(raw: string | null | undefined): WorkNotes {
  if (!raw) return EMPTY_NOTES;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return EMPTY_NOTES; }
  if (!isRecord(value)) return EMPTY_NOTES;
  const roles: Record<string, RoleKey> = {};
  if (isRecord(value.roles)) for (const [k, v] of Object.entries(value.roles)) if (isRole(v)) roles[k] = v;
  const targets: Record<string, number> = {};
  if (isRecord(value.targets)) for (const [k, v] of Object.entries(value.targets)) if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) targets[k] = v;
  const plans: Record<string, string[]> = {};
  if (isRecord(value.plans)) for (const [k, v] of Object.entries(value.plans)) if (Array.isArray(v)) plans[k] = v.filter((x): x is string => typeof x === "string").map((x) => clean(x, LIMITS.line)).filter((x) => x.trim() !== "").slice(0, LIMITS.plan);
  const todos: Record<string, Todo[]> = {};
  if (isRecord(value.todos)) {
    for (const [k, v] of Object.entries(value.todos)) {
      if (!Array.isArray(v)) continue;
      todos[k] = v.flatMap((x) => (isRecord(x) && typeof x.id === "string" && typeof x.text === "string" && x.text.trim() !== "" ? [{ id: x.id.slice(0, 40), text: clean(x.text, LIMITS.line), done: x.done === true }] : [])).slice(0, LIMITS.todos);
    }
  }
  return {
    thesis: typeof value.thesis === "string" ? clean(value.thesis, LIMITS.thesis) : "",
    roles, targets, plans, todos,
    lastChapterId: typeof value.lastChapterId === "string" ? value.lastChapterId : null,
    selfNote: typeof value.selfNote === "string" ? clean(value.selfNote, LIMITS.note) : "",
  };
}

export function loadNotes(storage: NoteStorage | null, workId: string): WorkNotes {
  try { return parseNotes(storage?.getItem(notesKey(workId))); } catch { return EMPTY_NOTES; }
}

export function saveNotes(storage: NoteStorage | null, workId: string, notes: WorkNotes): boolean {
  try {
    storage?.setItem(notesKey(workId), JSON.stringify(notes));
    return storage != null;
  } catch { return false; }
}

/** Entries of chapters that no longer exist are dropped. */
export function pruneNotes(notes: WorkNotes, liveIds: readonly string[]): WorkNotes {
  const live = new Set(liveIds);
  const keep = <T>(record: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(record).filter(([k]) => live.has(k)));
  return { ...notes, roles: keep(notes.roles) as Roles, targets: keep(notes.targets), plans: keep(notes.plans), todos: keep(notes.todos), lastChapterId: notes.lastChapterId && live.has(notes.lastChapterId) ? notes.lastChapterId : null };
}

export const withThesis = (n: WorkNotes, text: string): WorkNotes => ({ ...n, thesis: clean(text, LIMITS.thesis) });
export const withRole = (n: WorkNotes, id: string, role: RoleKey): WorkNotes => ({ ...n, roles: { ...n.roles, [id]: role } });
export const withTargets = (n: WorkNotes, targets: Readonly<Record<string, number>>): WorkNotes => ({ ...n, targets });
export const withSelfNote = (n: WorkNotes, text: string): WorkNotes => ({ ...n, selfNote: clean(text, LIMITS.note) });
export const withLast = (n: WorkNotes, id: string | null): WorkNotes => (n.lastChapterId === id ? n : { ...n, lastChapterId: id });

export function withPlan(n: WorkNotes, id: string, multiline: string): WorkNotes {
  const lines = multiline.split("\n").map((l) => clean(l, LIMITS.line).trim()).filter((l) => l !== "").slice(0, LIMITS.plan);
  const plans = { ...n.plans };
  if (lines.length === 0) delete plans[id]; else plans[id] = lines;
  return { ...n, plans };
}

export function withTodoAdded(n: WorkNotes, id: string, text: string, newId: string): WorkNotes {
  const t = clean(text, LIMITS.line).trim();
  const current = n.todos[id] ?? [];
  if (t === "" || current.length >= LIMITS.todos) return n;
  return { ...n, todos: { ...n.todos, [id]: [...current, { id: newId, text: t, done: false }] } };
}

export function withTodoDone(n: WorkNotes, id: string, todoId: string, done: boolean): WorkNotes {
  return { ...n, todos: { ...n.todos, [id]: (n.todos[id] ?? []).map((x) => (x.id === todoId ? { ...x, done } : x)) } };
}

export function withTodoRemoved(n: WorkNotes, id: string, todoId: string): WorkNotes {
  return { ...n, todos: { ...n.todos, [id]: (n.todos[id] ?? []).filter((x) => x.id !== todoId) } };
}

export const openTodos = (n: WorkNotes, id: string) => (n.todos[id] ?? []).filter((x) => !x.done);

/** A plan item counts as "in the text" when half of its stems (>= 5 letters) occur there (plus.js; only from 150 words on). */
export function planItemInText(item: string, chapterText: string, normalize: (s: string) => string): boolean {
  const stems = normalize(item).split(/[^a-z0-9]+/u).filter((w) => w.length >= 5).map((w) => w.slice(0, 5));
  if (stems.length === 0) return false;
  const text = normalize(chapterText);
  return stems.filter((s) => text.includes(s)).length >= stems.length / 2;
}
