// PIL-D2-ZIP: the real port of the bulk download, over the transport the page gives (createApi's, through
// src/client). It asks teacher.submissions-bulk-link.post for a short-lived link; the ZIP itself is the
// browser's GET of that link (teacher.submissions-bulk.get), never a call made here. No network primitive.
import { requestBulkLink, type BulkCall, type BulkPort } from "./contract";

/** The port over a transport; an ended session calls `onExpired` once per request that found it. */
export function bulkPort(call: BulkCall, onExpired: () => void = () => {}): BulkPort {
  return {
    requestLink: async (assignmentId, format) => {
      const outcome = await requestBulkLink(call, assignmentId, format);
      if (outcome.kind === "session-expired") onExpired();
      return outcome;
    },
  };
}
