/**
 * Reads the versioned document of a work for the text elements (WEB-2153). The shared live reader
 * accepts only document v1, so a v2/v3 text (citations, footnotes) never reaches the page; this one
 * asks the same contract operation (`live.document.get`) and accepts any version, still only from
 * the exact JCS bytes whose SHA-256 equals the ETag. Anything else is "unavailable", never shown in part.
 */
import { browserTransport, createApi, type ProtocolVersion } from "@/client/api";
import { verifyVersionedDocumentSnapshot } from "../../../../../editor-core/src/document/document/snapshot";
import type { VersionedDocument } from "../../../../../editor-core/src/document/document";

const PROTOCOL = "1" satisfies ProtocolVersion;
const ETAG = /^"([0-9a-f]{64})"$/;

export type ElementsRead =
  | { kind: "document"; document: VersionedDocument }
  | { kind: "empty" | "signedOut" | "notFound" | "unavailable" };

export async function readVersionedDocument(documentId: string, fetcher: typeof browserTransport = browserTransport, baseUrl?: string): Promise<ElementsRead> {
  let status = 0;
  let etag: string | null = null;
  let bytes: Uint8Array | null = null;
  const transport: typeof browserTransport = async (input, init) => {
    const response = await fetcher(input, { ...init, credentials: "same-origin", cache: "no-store" });
    status = response.status;
    etag = response.headers.get("etag");
    bytes = response.status === 200 ? new Uint8Array(await response.clone().arrayBuffer()) : null;
    return response;
  };
  try {
    const result = await createApi({ fetchImpl: transport, protocol: PROTOCOL, ...(baseUrl === undefined ? {} : { baseUrl }) })(
      "live.document.get", { params: { documentId }, query: undefined, body: undefined },
    );
    if (!result.ok) return { kind: status === 401 ? "signedOut" : status === 404 ? "notFound" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
  if (status === 204) return { kind: "empty" };
  const sum = ETAG.exec(etag ?? "")?.[1];
  if (status !== 200 || sum === undefined || bytes === null) return { kind: "unavailable" };
  const snapshot = await verifyVersionedDocumentSnapshot(bytes);
  return snapshot.ok && snapshot.sha256 === sum ? { kind: "document", document: snapshot.document } : { kind: "unavailable" };
}
