// WEB-1803 (M8.6): the package for the registrar's office, on the receipt of a submission. TODO(ugovor):
// the routes are not in @ductura/contracts yet; the answer is the one of editor/export/preparation.ts.
//   student.submission-package.post         { assignmentId, requestKey } -> 202 answer (the same key is the same package)
//   student.submission-package.get          { assignmentId, packageId }  -> 200 answer
//   student.submission-package-cancel.post  { assignmentId, packageId }  -> 204
//   GET <downloadPath> under /api/v1/student/assignments/<assignmentId>/package/ -> the ZIP
import { SERVER_PREFIX } from "../../../../../../src/client/api";
import type { PrepareCalls, Raw } from "../../editor/export/preparation";

export type PackageCall = (
  id: "student.submission-package.post" | "student.submission-package.get" | "student.submission-package-cancel.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<Raw>;

export const packageDownloadPrefix = (assignmentId: string): string =>
  `${SERVER_PREFIX}student/assignments/${encodeURIComponent(assignmentId)}/package/`;

export function packageCalls(call: PackageCall, assignmentId: string, requestKey: string): PrepareCalls {
  return {
    start: (): Promise<Raw> => call("student.submission-package.post", { body: { assignmentId, requestKey } }),
    read: (packageId): Promise<Raw> => call("student.submission-package.get", { params: { assignmentId, packageId } }),
    cancel: (packageId) => call("student.submission-package-cancel.post", { params: { assignmentId, packageId } }),
  };
}

export const packageFileName = (assignmentId: string): string => `paket-za-referadu-${assignmentId.slice(0, 8)}.zip`;
