/**
 * What the teacher's literature overview shows (INVENTAR-editor §2.4
 * sources2.js litview, s2Seen, proofReq), derived from the canonical JSON of a
 * saved version of the work: the sources, how often each is cited, the
 * citations whose confirmation the mentor asked for (`rq`) and which sources
 * are new since the teacher last marked the literature as reviewed. Pure
 * functions, plus the review mark kept on this device.
 */
import { bibliographyTeacherHr as t } from "./messages.hr";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export type LitSource = { id: string; label: string; kind: string; title: string };
export type LitRequest = { sourceId: string; label: string; page: string | null; rq: string };
export type Literature = { sources: LitSource[]; cites: ReadonlyMap<string, number>; requests: LitRequest[] };
export type LitSeen = { when: string; ids: string[] };
export type OverviewRow = LitSource & { cites: number; fresh: boolean };

function authorName(author: unknown): string {
  if (!isObj(author)) return "";
  if (author.kind === "organization" && typeof author.name === "string") {
    return typeof author.acronym === "string" && author.acronym ? author.acronym : author.name;
  }
  return typeof author.family === "string" ? author.family : "";
}

/** "Autor (godina)", "A i B (godina)" or "A i sur. (godina)"; the title when there is no author. */
export function sourceLabel(source: Obj): string {
  const names = (Array.isArray(source.authors) ? source.authors : []).map(authorName).filter(Boolean);
  const who = names.length === 0 ? String(source.title ?? "") : names.length === 1 ? names[0]!
    : names.length === 2 ? `${names[0]} i ${names[1]}` : `${names[0]} i sur.`;
  return typeof source.year === "number" ? `${who} (${source.year})` : who;
}

export function kindName(type: unknown): string {
  const names: Record<string, string> = { book: t.typeBook, article: t.typeArticle, chapter: t.typeChapter, web: t.typeWeb };
  return typeof type === "string" ? names[type] ?? type : "";
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/**
 * The literature of one canonical document (`{nodes, sources}`); a document
 * without sources (v1) gives empty lists. Unknown nodes are walked through
 * their `children`, so any block that holds a citation counts.
 */
export function literatureOf(doc: unknown): Literature {
  const sources: LitSource[] = [];
  const byId = new Map<string, LitSource>();
  for (const raw of isObj(doc) && Array.isArray(doc.sources) ? doc.sources : []) {
    if (!isObj(raw) || typeof raw.id !== "string" || byId.has(raw.id)) continue;
    const source = { id: raw.id, label: sourceLabel(raw), kind: kindName(raw.type), title: String(raw.title ?? "") };
    byId.set(raw.id, source);
    sources.push(source);
  }
  const cites = new Map<string, number>();
  const requests: LitRequest[] = [];
  const walk = (node: unknown) => {
    if (!isObj(node)) return;
    if (node.type === "citation" && typeof node.sourceId === "string") {
      cites.set(node.sourceId, (cites.get(node.sourceId) ?? 0) + 1);
      const rq = text(node.rq);
      if (rq !== null) {
        const source = byId.get(node.sourceId);
        requests.push({ sourceId: node.sourceId, label: source?.label ?? node.sourceId, page: text(node.locator), rq });
      }
      return;
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  if (isObj(doc) && Array.isArray(doc.nodes)) doc.nodes.forEach(walk);
  return { sources, cites, requests };
}

/** Rows of the overview, alphabetical as in the prototype (`localeCompare` hr). */
export function overviewRows(lit: Literature, seen: LitSeen | null): OverviewRow[] {
  return [...lit.sources]
    .sort((a, b) => a.label.localeCompare(b.label, "hr"))
    .map((s) => ({ ...s, cites: lit.cites.get(s.id) ?? 0, fresh: seen !== null && !seen.ids.includes(s.id) }));
}

/** "N izvora · citirano N · novo od pregleda {datum}: N" or "… · mentor još nije označio pregled". */
export function overviewSummary(rows: readonly OverviewRow[], seen: LitSeen | null): string {
  const head = t.summary(rows.length, rows.filter((r) => r.cites > 0).length);
  return head + (seen ? t.summarySeen(seen.when, rows.filter((r) => r.fresh).length) : t.summaryNotSeen);
}

/** A date as the prototype writes it: "22. 11. 2026.". */
export function hrDate(date: Date): string {
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}.`;
}

/** The date of an ISO time ("2026-11-27T22:41:00.000Z") in the Croatian form, or the text itself. */
export function hrDay(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : hrDate(at);
}

const KEY = (documentId: string) => `ductura.teacher.lit-seen:${documentId}`;

type Store = Pick<Storage, "getItem" | "setItem">;
const storage = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** The teacher's review mark for this work on this device; anything malformed reads as none. */
export function readSeen(documentId: string, store: Store | null = storage()): LitSeen | null {
  try {
    const value: unknown = JSON.parse(store?.getItem(KEY(documentId)) ?? "null");
    if (!isObj(value) || typeof value.when !== "string" || !Array.isArray(value.ids)) return null;
    return { when: value.when, ids: value.ids.filter((id): id is string => typeof id === "string") };
  } catch {
    return null;
  }
}

/** Marks every current source as reviewed today; false when the device keeps nothing. */
export function writeSeen(documentId: string, seen: LitSeen, store: Store | null = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(KEY(documentId), JSON.stringify(seen));
    return true;
  } catch {
    return false;
  }
}
