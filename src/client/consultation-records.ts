import { browserTransport, createApi, type ApiOptions, type ApiResult, type Input } from "./api";

type Body<T> = Extract<T, { ok: true }> extends { body: infer Shape } ? Shape : never;
export type ConsultationRecord = Body<ApiResult<"work.consultation-records.post">>;
export type ConsultationAddition = Body<ApiResult<"work.consultation-additions.post">>;
export type ConsultationInput = Input<"work.consultation-records.post">["body"];
export type VersionsPage = Body<ApiResult<"work.versions.get">>;

async function readBody<T>(request: () => Promise<{ ok: true; body: T } | { ok: false }>): Promise<T | null> {
  try {
    const answer = await request();
    return answer.ok ? answer.body : null;
  } catch {
    return null;
  }
}

export async function readConsultations(documentId: string, options?: ApiOptions) {
  const answer = await readConsultationList(documentId, options);
  return answer.kind === "ready" ? answer.records : null;
}

/**
 * Design alignment 27. 11. 2026. (N-11): the list with the status that decides the
 * page: 401 leads to sign-in, 403 and 404 have their own states, the rest is a
 * read that can be tried again.
 */
export type ConsultationListRead =
  | { kind: "ready"; records: Body<ApiResult<"work.consultation-records.get">>["records"] }
  | { kind: "unauthorized" | "forbidden" | "not-found" | "unavailable" };

export async function readConsultationList(documentId: string, options?: ApiOptions): Promise<ConsultationListRead> {
  try {
    const answer = await createApi(options)("work.consultation-records.get", {
      params: { documentId }, query: undefined, body: undefined,
    });
    if (answer.ok) return Array.isArray(answer.body?.records) ? { kind: "ready", records: answer.body.records } : { kind: "unavailable" };
    if (answer.status === 401) return { kind: "unauthorized" };
    if (answer.status === 403) return { kind: "forbidden" };
    if (answer.status === 404) return { kind: "not-found" };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function readConsultationVersions(documentId: string, beforeRevision: number | null, options: ApiOptions = {}) {
  if (beforeRevision !== null && (!Number.isSafeInteger(beforeRevision) || beforeRevision < 2)) return null;
  const transport = options.fetchImpl ?? browserTransport;
  const answer = await readBody(() => createApi({
    ...options,
    // The temporary contract bridge cannot serialise query parameters yet.
    // Attach the checked cursor to this route until the published client carries it.
    fetchImpl(input, init) {
      const url = new URL(String(input));
      if (beforeRevision !== null) url.searchParams.set("beforeRevision", String(beforeRevision));
      return transport(url, init);
    },
  })("work.versions.get", { params: { documentId }, query: {}, body: undefined }));
  if (answer?.nextBeforeRevision != null && beforeRevision !== null && answer.nextBeforeRevision >= beforeRevision) {
    return null;
  }
  return answer;
}

export function saveConsultation(documentId: string, body: ConsultationInput, options?: ApiOptions) {
  return readBody(() => createApi(options)("work.consultation-records.post", {
    params: { documentId }, query: undefined, body,
  }));
}

export function addConsultationNote(documentId: string, recordId: string, text: string, options?: ApiOptions) {
  return readBody(() => createApi(options)("work.consultation-additions.post", {
    params: { documentId, recordId }, query: undefined, body: { text },
  }));
}
