import { browserTransport, createApi, type ApiOptions, type ApiResult } from "./api";

type Success = Extract<ApiResult<"work.source-notes.get">, { ok: true }>;
export type SourceNote = Success["body"]["notes"][number];
export type SourceNotesRead =
  | { kind: "ready"; notes: readonly SourceNote[] }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

export async function readSourceNotes(
  documentId: string, sourceId: string, signal?: AbortSignal, options: ApiOptions = {},
): Promise<SourceNotesRead> {
  try {
    const transport = options.fetchImpl ?? browserTransport;
    const api = createApi({
      ...options,
      fetchImpl: (url, init) => transport(url, { ...init, signal, cache: "no-store" }),
    });
    const result = await api("work.source-notes.get", {
      params: { id: documentId, sourceId }, body: undefined, query: undefined,
    });
    if (result.ok) return { kind: "ready", notes: result.body.notes };
    if (result.status === 401) return { kind: "signedOut" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
