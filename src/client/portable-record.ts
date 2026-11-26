import { portableRecordCall, portableRecordIdFits } from "./api";

/**
 * The portable record of a submission, the student's download (WEB-1304; plan M7.10).
 *
 * The route is student.portable-record.get of the contract. The answer is a file, not JSON, so
 * createApi cannot carry it: portableRecordCall, in the client module that owns API paths, takes the contract's path and this module
 * reads the answer. The id must fit the contract's params before anything is sent.
 *
 * The answer maps onto one closed table, and the page never says more than it knows:
 * - 200 with a non-empty body is `ready` with the bytes the server sent, untouched;
 * - 401 is `signedOut` (the shell's flow for an ended session);
 * - 403 and 404 are both `notFound`, so the page never tells whether the submission exists;
 * - anything else, an empty body or a broken connection is `unavailable`.
 */
export type PortableRecordResult =
  | { readonly kind: "ready"; readonly bytes: ArrayBuffer; readonly filename: string; readonly type: string }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type PortableRecordOptions = {
  readonly baseUrl?: string;
  readonly transport?: Parameters<typeof portableRecordCall>[0];
};

function filenameOf(header: string | null, submissionId: string): string {
  const named = header === null ? null : /filename="?([A-Za-z0-9._-]{1,120})"?/.exec(header)?.[1];
  return named ?? `prenosivi-zapis-${submissionId.slice(0, 8).toLowerCase()}.zip`;
}

export async function downloadPortableRecord(
  submissionId: string, options: PortableRecordOptions = {},
): Promise<PortableRecordResult> {
  if (!portableRecordIdFits(submissionId)) return { kind: "notFound" };
  try {
    const response = await portableRecordCall(options.transport, options.baseUrl)(submissionId);
    if (response.status === 401) return { kind: "signedOut" };
    if (response.status === 403 || response.status === 404) return { kind: "notFound" };
    if (response.status !== 200) return { kind: "unavailable" };
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) return { kind: "unavailable" };
    return {
      kind: "ready",
      bytes,
      filename: filenameOf(response.headers.get("content-disposition"), submissionId),
      type: response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return { kind: "unavailable" };
  }
}
