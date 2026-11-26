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

/** What the student may write in a note; at least one field is text (the contract's shapes bound each). */
export type SourceNoteDraft = { quote?: string | null; page?: string | null; note?: string | null };
export type SourceNoteWrite =
  | { kind: "ok"; note: SourceNote }
  | { kind: "signedOut" | "invalid" | "notFound" | "unavailable" };
export type SourceNoteDelete = { kind: "ok" | "signedOut" | "invalid" | "notFound" | "unavailable" };

// Blank text is stored as no text: the contract refuses a string of only whitespace.
const clean = (value: string | null | undefined) => (value == null || value.trim() === "" ? null : value);
const isEmpty = (draft: SourceNoteDraft) => !clean(draft.quote) && !clean(draft.page) && !clean(draft.note);

function failure(result: { ok: false; status: number }): Exclude<SourceNoteWrite, { kind: "ok" }> {
  if (result.status === 401) return { kind: "signedOut" };
  if (result.status === 404) return { kind: "notFound" };
  // 0 is a draft the shared client refused before sending; 400/422 are the server's refusal.
  if (result.status === 0 || result.status === 400 || result.status === 422) return { kind: "invalid" };
  return { kind: "unavailable" };
}

export async function createSourceNote(
  documentId: string, sourceId: string, draft: SourceNoteDraft, options: ApiOptions = {},
): Promise<SourceNoteWrite> {
  if (isEmpty(draft)) return { kind: "invalid" };
  try {
    const result = await createApi(options)("work.source-notes.post", {
      params: { id: documentId, sourceId }, query: undefined,
      body: { quote: clean(draft.quote), page: clean(draft.page), note: clean(draft.note) },
    });
    return result.ok ? { kind: "ok", note: result.body } : failure(result);
  } catch {
    return { kind: "unavailable" };
  }
}

/** PATCH sends the three fields as they now stand, so a cleared field is stored as empty. */
export async function updateSourceNote(
  documentId: string, sourceId: string, noteId: string, draft: SourceNoteDraft, options: ApiOptions = {},
): Promise<SourceNoteWrite> {
  if (isEmpty(draft)) return { kind: "invalid" };
  try {
    const result = await createApi(options)("work.source-notes.patch", {
      params: { id: documentId, sourceId }, query: undefined,
      body: { noteId, quote: clean(draft.quote), page: clean(draft.page), note: clean(draft.note) },
    });
    return result.ok ? { kind: "ok", note: result.body } : failure(result);
  } catch {
    return { kind: "unavailable" };
  }
}

export async function deleteSourceNote(
  documentId: string, sourceId: string, noteId: string, options: ApiOptions = {},
): Promise<SourceNoteDelete> {
  try {
    const result = await createApi(options)("work.source-notes.delete", {
      params: { id: documentId, sourceId }, query: { noteId }, body: undefined,
    });
    return result.ok ? { kind: "ok" } : failure(result);
  } catch {
    return { kind: "unavailable" };
  }
}
