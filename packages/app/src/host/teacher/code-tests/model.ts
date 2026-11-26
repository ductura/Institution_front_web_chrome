// WEB-V21-KOD-TESTOVI-OBRAZAC: the pure model of the teacher's code-test form. The checks are the server's
// (teacher.assignment-code-tests.put), repeated to spare a round trip: up to 10 tests, a title of 1 to 120
// characters, input and expected as JSON, the whole body at most 16 KiB. The server stays the judge.
export const MAX_TESTS = 10;
export const MAX_BYTES = 16 * 1024;
export const MAX_TITLE = 120;
export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** A test as the server holds it. */
export type CodeTest = { readonly id: string; readonly title: string; readonly input: unknown; readonly expected: unknown };
export type CodeTestsBody = { readonly language: "javascript"; readonly tests: readonly CodeTest[] };
export type CodeTestsView = CodeTestsBody & { readonly revisionNo: number };

/** A test as the teacher is typing it: input and expected are text until they are checked. */
export type RowDraft = { readonly key: string; readonly id: string | null; readonly title: string; readonly input: string; readonly expected: string };

export type RowError = "title" | "input" | "expected";
export type FormError =
  | { readonly kind: "row"; readonly index: number; readonly field: RowError }
  | { readonly kind: "count" }
  | { readonly kind: "size" };
export type Checked = { readonly ok: true; readonly value: CodeTestsBody } | { readonly ok: false; readonly error: FormError };

const text = (value: unknown): string => JSON.stringify(value) ?? "null";

export function draftOf(view: CodeTestsView): RowDraft[] {
  return view.tests.map((t, i) => ({ key: `k${i}`, id: t.id, title: t.title, input: text(t.input), expected: text(t.expected) }));
}

export const nextKey = (rows: readonly RowDraft[]): string => `k${rows.reduce((max, r) => Math.max(max, Number(r.key.slice(1)) + 1), 0)}`;

export const emptyRow = (rows: readonly RowDraft[]): RowDraft => ({ key: nextKey(rows), id: null, title: "", input: "", expected: "" });

/** Parses JSON text; empty or invalid text is refused, never turned into null. */
export function parseJson(source: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  if (source.trim() === "") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(source) as unknown };
  } catch {
    return { ok: false };
  }
}

/** An id for a new test: unused, matching the server's pattern; saved tests keep theirs. */
function freshId(taken: ReadonlySet<string>): string {
  let n = 1;
  while (taken.has(`t${n}`)) n += 1;
  return `t${n}`;
}

export const byteLength = (body: CodeTestsBody): number => new TextEncoder().encode(JSON.stringify(body)).length;

export function checkDraft(rows: readonly RowDraft[]): Checked {
  if (rows.length > MAX_TESTS) return { ok: false, error: { kind: "count" } };
  const taken = new Set(rows.flatMap((r) => (r.id !== null && ID_PATTERN.test(r.id) ? [r.id] : [])));
  const tests: CodeTest[] = [];
  for (const [index, row] of rows.entries()) {
    const title = row.title.trim();
    if (title.length < 1 || title.length > MAX_TITLE) return { ok: false, error: { kind: "row", index, field: "title" } };
    const input = parseJson(row.input);
    if (!input.ok) return { ok: false, error: { kind: "row", index, field: "input" } };
    const expected = parseJson(row.expected);
    if (!expected.ok) return { ok: false, error: { kind: "row", index, field: "expected" } };
    const id = row.id !== null && ID_PATTERN.test(row.id) ? row.id : freshId(taken);
    taken.add(id);
    tests.push({ id, title, input: input.value, expected: expected.value });
  }
  const value: CodeTestsBody = { language: "javascript", tests };
  return byteLength(value) > MAX_BYTES ? { ok: false, error: { kind: "size" } } : { ok: true, value };
}

/** Whether the rows differ from what the server holds (a revision never read is an empty list). */
export function isChanged(rows: readonly RowDraft[], saved: CodeTestsView | null): boolean {
  const held = saved === null ? [] : draftOf(saved);
  return rows.length !== held.length || rows.some((r, i) => r.title !== held[i]!.title || r.input !== held[i]!.input || r.expected !== held[i]!.expected);
}

/** What the student is shown: each test with its input and expected output, nothing else. Rows that do not check yet are left out. */
export function studentView(rows: readonly RowDraft[]): { readonly title: string; readonly input: string; readonly expected: string }[] {
  return rows.flatMap((r) => {
    const title = r.title.trim();
    const input = parseJson(r.input);
    const expected = parseJson(r.expected);
    return title.length > 0 && input.ok && expected.ok ? [{ title, input: text(input.value), expected: text(expected.value) }] : [];
  });
}
