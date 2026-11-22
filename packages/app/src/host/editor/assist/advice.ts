// WEB-2128: roles of chapters, the recommendation by role and the observations
// "Za pogledati, iz Vašeg teksta" (INVENTAR-editor §2.4 advice.js). Heuristics
// over the student's own text; no model, no AI. Every observation is a hint
// with the source "Ductura, iz Vašeg teksta" and is never a faculty rule.
import { assistHr as t, type RoleKey } from "./messages.hr";
import { norm, ownAndSub, type AssistChapter } from "./blocks";

export const ROLE_KEYS = ["uvod", "teorija", "metodologija", "empirija", "rasprava", "zakljucak", "drugo"] as const satisfies readonly RoleKey[];
/** Fewest words in a chapter before observations about its content appear. */
export const MIN_WORDS = 150;

export type Roles = Readonly<Record<string, RoleKey>>;

export function isRole(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

export function guessRole(title: string): RoleKey {
  const n = norm(title).trim();
  if (/^uvod/u.test(n)) return "uvod";
  if (/zakljuc/u.test(n)) return "zakljucak";
  if (/rasprav|diskusij/u.test(n)) return "rasprava";
  if (/metod|dizajn istraz|nacrt istraz/u.test(n)) return "metodologija";
  if (/teorij|konceptual|okvir|pregled literature|dosadasnj/u.test(n)) return "teorija";
  return "empirija";
}

/** The chosen role, else the guess; a subchapter takes the role of its parent (or "drugo"). */
export function roleOf(chapters: readonly AssistChapter[], id: string, roles: Roles): RoleKey {
  const chapter = chapters.find((c) => c.id === id);
  if (!chapter) return "drugo";
  if (chapter.parentId !== null) return roleOf(chapters, chapter.parentId, roles);
  return roles[id] ?? guessRole(chapter.title);
}

const STOP = new Set(["nacin", "nacinu", "izmedu", "danas", "kojim", "kojima", "kojoj", "tijekom", "nakon", "prema", "kakav", "kakva", "kakvo", "utjecu", "utjece", "oblikovali", "oblikovala", "povezano", "povezana", "razlikuju", "redovito", "godine", "razdoblju", "drugoga", "svjetskog"]);

export type ThesisTerm = { readonly stem: string; readonly word: string };

/** Words of the question of the work (>= 6 letters, no stop word, at most 8) that occur anywhere in the work. */
export function thesisTerms(thesis: string, wholeText: string): ThesisTerm[] {
  const seen = new Set<string>();
  const terms: ThesisTerm[] = [];
  const whole = norm(wholeText);
  for (const raw of thesis.split(/[^\p{L}\p{N}]+/u)) {
    const word = raw.toLowerCase();
    const n = norm(word);
    if (n.length < 6 || STOP.has(n)) continue;
    const stem = n.slice(0, 7);
    if (seen.has(stem)) continue;
    seen.add(stem);
    terms.push({ stem, word });
    if (terms.length >= 8) break;
  }
  return terms.filter((term) => whole.includes(term.stem));
}

export function hypothesesOf(text: string): string[] {
  return [...new Set(text.match(/\bH\d\b/gu) ?? [])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export type AdviceInput = {
  readonly chapters: readonly AssistChapter[];
  readonly thesis: string;
  readonly roles: Roles;
};

function mentions(text: string, labels: readonly string[]): string[] {
  const found = new Set(text.match(/\bH\d\b/gu) ?? []);
  return labels.filter((label) => found.has(label));
}

/** Observations about one top chapter, from its own text and its subchapters. */
export function observationsOf(input: AdviceInput, id: string): { ready: boolean; items: string[] } {
  const { chapters, thesis, roles } = input;
  const chapter = chapters.find((c) => c.id === id);
  if (!chapter) return { ready: false, items: [] };
  const role = roleOf(chapters, id, roles);
  const agg = chapter.parentId === null ? ownAndSub(chapters, id) : { text: chapter.text, words: chapter.words, cites: chapter.cites };
  const { cites } = agg;
  const ownText = agg.text;
  const ownWords = agg.words;
  const items: string[] = [];
  const wholeText = chapters.map((c) => c.text).join("\n");
  const labels = hypothesesOf(wholeText);
  const n = norm(ownText);
  const ready = ownWords >= MIN_WORDS;
  if (chapter.parentId === null && ready) {
    const terms = thesisTerms(thesis, wholeText);
    if (terms.length >= 2 && role !== "uvod" && role !== "metodologija" && !terms.some((term) => n.includes(term.stem))) {
      items.push(t.obs.noTerms(terms.map((term) => term.word).join(", ")));
    }
    if ((role === "teorija" || role === "empirija") && ownWords >= 300 && cites < ownWords / 400) {
      items.push(t.obs.fewCites(cites, ownWords));
    }
    if (role === "metodologija") {
      const missing = (Object.keys(t.obs.methodParts) as (keyof typeof t.obs.methodParts)[]).filter((key) => !n.includes(key));
      if (missing.length > 0) items.push(t.obs.methodMissing(missing.map((key) => t.obs.methodParts[key]).join(", ")));
    }
    if (role === "uvod") {
      if (!/pitanj|cilj/u.test(n) && !ownText.includes("?")) items.push(t.obs.noQuestion);
      if (!/struktur|poglavlj/u.test(n)) items.push(t.obs.noStructure);
      if (labels.length > 0 && mentions(ownText, labels).length === 0 && !/hipotez|ocekivanj/u.test(n)) items.push(t.obs.noHypothesesAnnounced);
    }
    if ((role === "rasprava" || role === "zakljucak") && labels.length > 0) {
      const missing = labels.filter((label) => !mentions(ownText, labels).includes(label));
      if (missing.length > 0) items.push(t.obs.missingHypotheses(missing.join(", ")));
    }
    if (role === "zakljucak") {
      if (labels.length > 0 && !/potvrden|potvrdu|odbacen|opovrgn|djelomic/u.test(n)) items.push(t.obs.notConfirmed);
      if (!/ogranic/u.test(n)) items.push(t.obs.noLimits);
    }
  }
  // Balance of subchapters: one clearly shorter than the rest of its chapter.
  if (chapter.parentId !== null) {
    const siblings = chapters.filter((c) => c.parentId === chapter.parentId);
    if (siblings.length >= 2) {
      const mean = Math.round(siblings.reduce((sum, c) => sum + c.words, 0) / siblings.length);
      if (mean > 200 && chapter.words >= 30 && chapter.words < mean * 0.45) {
        items.push(t.obs.shorter(chapter.words, mean));
        return { ready: true, items };
      }
    }
  }
  return { ready, items };
}

/** Every observation of the work in document order, with its chapter. */
export function allObservations(input: AdviceInput): { chapterId: string; text: string }[] {
  return input.chapters.flatMap((c) => observationsOf(input, c.id).items.map((text) => ({ chapterId: c.id, text })));
}

export type WholeNote = { readonly text: string; readonly hint?: string; readonly chapterId?: string };

/** "Nit rada": notes about the work as a whole. */
export function wholeNotes(input: AdviceInput): WholeNote[] {
  const { chapters, thesis, roles } = input;
  const notes: WholeNote[] = [];
  const top = chapters.filter((c) => c.parentId === null);
  const wholeText = chapters.map((c) => c.text).join("\n");
  const labels = hypothesesOf(wholeText);
  if (thesis.trim() === "") notes.push({ text: t.whole.noThesis, hint: t.whole.noThesisHint });
  for (const label of labels) {
    const where = top.filter((c) => mentions(ownAndSub(chapters, c.id).text, [label]).length > 0);
    if (where.length === 1) {
      const only = where[0]!;
      notes.push({ text: t.whole.onlyOnce(label, only.number, only.title), hint: t.whole.onlyOnceHint, chapterId: only.id });
    }
  }
  for (const chapter of top) {
    const role = roleOf(chapters, chapter.id, roles);
    if (role !== "rasprava" && role !== "zakljucak") continue;
    const own = observationsOf(input, chapter.id).items.filter((item) => item === t.obs.notConfirmed || item.startsWith("Ne spominje H"));
    for (const text of own) notes.push({ text, chapterId: chapter.id });
  }
  const conclusion = top.find((c) => roleOf(chapters, c.id, roles) === "zakljucak");
  if (conclusion && conclusion.words > 0) {
    const terms = thesisTerms(thesis, wholeText);
    const n = norm(ownAndSub(chapters, conclusion.id).text);
    const missing = terms.filter((term) => !n.includes(term.stem));
    if (terms.length >= 2 && missing.length >= terms.length / 2) {
      notes.push({ text: t.whole.weakReturn, hint: t.whole.weakReturnMissing(missing.map((term) => term.word).join(", ")), chapterId: conclusion.id });
    }
  }
  return notes;
}

export type ThreadTable = { readonly columns: readonly { id: string; number: string }[]; readonly rows: readonly { label: string; cells: readonly boolean[] }[] };

/** Rows are hypothesis labels, columns the top chapters; a cell is true where the hypothesis is mentioned. */
export function threadTable(chapters: readonly AssistChapter[]): ThreadTable {
  const top = chapters.filter((c) => c.parentId === null);
  const labels = hypothesesOf(chapters.map((c) => c.text).join("\n"));
  return {
    columns: top.map((c) => ({ id: c.id, number: c.number })),
    rows: labels.map((label) => ({ label, cells: top.map((c) => mentions(ownAndSub(chapters, c.id).text, [label]).length > 0) })),
  };
}
