export type WorkDocxResult =
  | { ok: true; blob: Blob; snapshotSha256: string }
  | { ok: false; reason: "notFound" | "invalidRequest" | "downloadFailed" };

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function requestWorkDocx(
  documentId: string,
  versionId: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<WorkDocxResult> {
  const query = new URLSearchParams({ format: "docx", versionId });
  const response = await request(`/api/v1/works/${encodeURIComponent(documentId)}/export?${query}`, {
    method: "GET",
    headers: { Accept: DOCX },
    credentials: "same-origin",
    signal,
  });

  if (response.status === 404) return { ok: false, reason: "notFound" };
  if (response.status === 422) return { ok: false, reason: "invalidRequest" };
  const snapshotSha256 = response.headers.get("X-Export-Snapshot-Sha256");
  const contentType = response.headers.get("Content-Type")?.split(";")[0].trim();
  if (!response.ok || contentType !== DOCX || !snapshotSha256 || !/^[a-f0-9]{64}$/i.test(snapshotSha256)) {
    return { ok: false, reason: "downloadFailed" };
  }

  return { ok: true, blob: await response.blob(), snapshotSha256 };
}
