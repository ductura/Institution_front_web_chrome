/** Pure logic of the command palette (prototype INVENTAR-editor, "Naredbena paleta"). */

export type Command = {
  id: string;
  label: string;
  /** The small note on the right of the item. */
  hint?: string;
  group: string;
  /** Visible but not runnable (the prototype hides; the plan shows them disabled). */
  disabled?: boolean;
  /** Listed only for a typed query (the prototype's chapters and sources), never in the empty list or as recent. */
  searchOnly?: boolean;
};

export const MAX_EMPTY = 10;
export const MAX_QUERY = 14;
export const MAX_RECENT = 4;

/** Search without diacritics: NFD, đ -> d, lower case (as the prototype). */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
}

export function matches(command: Command, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = fold(`${command.label} ${command.hint ?? ""} ${command.group}`);
  return words.every((w) => haystack.includes(w));
}

/** Recent first (no query), the ones starting with the first word first (query), capped. */
export function visibleCommands(commands: readonly Command[], query: string, recent: readonly string[]): Command[] {
  const q = query.trim();
  if (q === "") {
    const listed = commands.filter((c) => !c.searchOnly);
    const byId = new Map(listed.map((c) => [c.id, c]));
    const recents = recent.map((id) => byId.get(id)).filter((c): c is Command => c !== undefined).slice(0, MAX_RECENT);
    const seen = new Set(recents.map((c) => c.id));
    return [...recents, ...listed.filter((c) => !seen.has(c.id))].slice(0, MAX_EMPTY);
  }
  const first = fold(q).split(/\s+/)[0] ?? "";
  const found = commands.filter((c) => matches(c, q));
  const starts = found.filter((c) => fold(c.label).startsWith(first));
  return [...starts, ...found.filter((c) => !starts.includes(c))].slice(0, MAX_QUERY);
}

export type Section = { title: string; items: Command[] };

/** Sections in order of first appearance; "Nedavno" leads the empty query. */
export function sections(items: readonly Command[], query: string, recent: readonly string[]): Section[] {
  const out: Section[] = [];
  const push = (title: string, item: Command) => {
    const s = out.find((x) => x.title === title);
    if (s) s.items.push(item);
    else out.push({ title, items: [item] });
  };
  const recents = query.trim() === "" ? new Set(recent.slice(0, MAX_RECENT)) : new Set<string>();
  for (const c of items) push(recents.has(c.id) ? "Nedavno" : c.group, c);
  return out;
}

/** Arrow keys over the runnable items; wraps; -1 when there are none. */
export function moveIndex(items: readonly Command[], from: number, step: 1 | -1): number {
  const n = items.length;
  if (items.every((c) => c.disabled)) return -1;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (i + step + n) % n;
    if (!items[i]!.disabled) return i;
  }
  return -1;
}

/** Recent list after running a command: most recent first, no duplicates. */
export function pushRecent(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

export const RECENT_KEY = "ductura-ck-recent";

/** Remembered locally; works without storage. */
export function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(recent: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    /* no storage: the palette still works */
  }
}
