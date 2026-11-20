type Version = {
  kind: "checkpoint" | "submission";
  revision: number;
  savedMinute: string;
};

export type Comparison = {
  from: Pick<Version, "revision" | "kind">;
  to: Pick<Version, "revision" | "kind">;
  blocks: readonly {
    op: "same" | "added" | "removed" | "changed";
    words: readonly { op: "same" | "added" | "removed"; text: string }[];
  }[];
  counts: { addedWords: number; removedWords: number };
  truncated: boolean;
};

type Result<T> = { ok: true; body: T } | { ok: false; status: number };
type VersionsPage = { versions: readonly Version[]; nextBeforeRevision: number | null };

/** The two createApi operations this view needs. WEB's contract bump supplies the implementation. */
export interface ComparisonApi {
  (id: "work.versions.get", input: {
    params: { documentId: string }; query: { beforeRevision?: string }; body: undefined;
  }): Promise<Result<VersionsPage>>;
  (id: "work.compare.get", input: {
    params: { documentId: string }; query: { from: string; to: string }; body: undefined;
  }): Promise<Result<Comparison>>;
}

type Failed = { kind: "not-found" | "error" };
export type Read<T> = { kind: "ready"; value: T } | Failed;

function failed(status: number): Failed {
  return { kind: status === 404 ? "not-found" : "error" };
}

export async function readSubmittedVersions(
  client: ComparisonApi, documentId: string, signal?: AbortSignal, limit = Infinity,
): Promise<Read<Version[]>> {
  const submitted = new Map<number, Version>();
  let beforeRevision: number | null = null;
  try {
    do {
      signal?.throwIfAborted();
      const page: Result<VersionsPage> = await client("work.versions.get", {
        params: { documentId }, query: beforeRevision === null ? {} : { beforeRevision: String(beforeRevision) }, body: undefined,
      });
      if (!page.ok) return failed(page.status);
      for (const version of page.body.versions) {
        if (version.kind === "submission") submitted.set(version.revision, version);
      }
      const next: number | null = page.body.nextBeforeRevision;
      if (next !== null && beforeRevision !== null && next >= beforeRevision) return failed(0);
      beforeRevision = next;
    } while (beforeRevision !== null && submitted.size < limit);
    return { kind: "ready", value: [...submitted.values()].sort((a, b) => b.revision - a.revision).slice(0, limit) };
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
    if (body.from.revision !== from || body.to.revision !== to ||
        body.from.kind !== "submission" || body.to.kind !== "submission") return failed(0);
    return { kind: "ready", value: body };
  } catch {
    return failed(0);
  }
}
