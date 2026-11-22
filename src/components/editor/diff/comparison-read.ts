type Version = {
  kind: "checkpoint" | "submission";
  revision: number;
  savedMinute: string;
};

type Block = { kind: "paragraph" | "bulletItem" | "quote" | "heading"; level?: number; change: "unchanged" | "removed" | "added"; text: string };
/** The server's comparison of two submitted revisions: its blocks of text, each unchanged, removed or added. */
export type Comparison = { from: number; to: number; blocks: readonly Block[] };

type Result<T> = { ok: true; body: T } | { ok: false; status: number };
type VersionsPage = { versions: readonly Version[]; nextBeforeRevision: number | null };

/** The two createApi operations this view needs, with the shapes of the generated contract. */
export interface ComparisonApi {
  (id: "work.versions.get", input: {
    params: { documentId: string }; query: undefined; body: undefined;
  }): Promise<Result<VersionsPage>>;
  (id: "work.compare.get", input: {
    params: { documentId: string }; query: { from: string; to: string }; body: undefined;
  }): Promise<Result<Comparison>>;
}

const words = (text: string) => text.split(/\s+/).filter((word) => word !== "").length;
/** The words added and removed, counted from the blocks the server sent. */
export function countWords(comparison: Comparison): { addedWords: number; removedWords: number } {
  let addedWords = 0, removedWords = 0;
  for (const { change, text } of comparison.blocks) {
    if (change === "added") addedWords += words(text);
    if (change === "removed") removedWords += words(text);
  }
  return { addedWords, removedWords };
}

type Failed = { kind: "not-found" | "error" };
export type Read<T> = { kind: "ready"; value: T } | Failed;

function failed(status: number): Failed {
  return { kind: status === 404 ? "not-found" : "error" };
}

/**
 * The submitted versions of the newest page the server sends. The contract of work.versions.get has no query
 * schema (no `beforeRevision`), so older pages cannot be asked for yet; `nextBeforeRevision` is left unread.
 * TODO(ugovor): page back when the contract names the query.
 */
export async function readSubmittedVersions(
  client: ComparisonApi, documentId: string, signal?: AbortSignal, limit = Infinity,
): Promise<Read<Version[]>> {
  try {
    signal?.throwIfAborted();
    const page = await client("work.versions.get", { params: { documentId }, query: undefined, body: undefined });
    if (!page.ok) return failed(page.status);
    const submitted = page.body.versions.filter((version) => version.kind === "submission");
    return { kind: "ready", value: [...new Map(submitted.map((version) => [version.revision, version])).values()]
      .sort((a, b) => b.revision - a.revision).slice(0, limit) };
  } catch {
    return failed(0);
  }
}

export async function readComparison(
  client: ComparisonApi, documentId: string, from: number, to: number,
): Promise<Read<Comparison>> {
  if (from === to) return failed(0);
  try {
    const result = await client("work.compare.get", {
      params: { documentId }, query: { from: String(from), to: String(to) }, body: undefined,
    });
    if (!result.ok) return failed(result.status);
    const { body } = result;
    if (body.from !== from || body.to !== to) return failed(0);
    return { kind: "ready", value: body };
  } catch {
    return failed(0);
  }
}
