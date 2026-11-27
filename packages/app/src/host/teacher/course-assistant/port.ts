// F4-PM1-R07: the teacher's switch of the Asistent for one course, through the contract only
// (teacher.course-assistant.get/put). A refusal is never an empty answer: "not found" (another course's,
// unknown and malformed ids read the same), "signed out" and "unavailable" are states of their own, and a
// write whose answer was lost is "unknown", never "done".
import { createApi } from "../../../../../../src/client/api";

export type AssistantCall = ReturnType<typeof createApi>;

export type AssistantRead =
  | { readonly kind: "ready"; readonly enabled: boolean }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type AssistantWrite =
  | { readonly kind: "done"; readonly enabled: boolean }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the switch may have been recorded. */
  | { readonly kind: "unknown" };

export type CourseAssistantPort = {
  read(courseId: string): Promise<AssistantRead>;
  write(courseId: string, enabled: boolean): Promise<AssistantWrite>;
};

const none = { query: undefined, body: undefined } as const;

export function courseAssistantPort(client: () => AssistantCall = () => createApi()): CourseAssistantPort {
  return {
    async read(courseId) {
      const r = await client()("teacher.course-assistant.get", { params: { courseId }, ...none }).catch(() => null);
      if (r === null) return { kind: "unavailable" };
      if (r.ok) return { kind: "ready", enabled: r.body.enabled };
      if (r.status === 401) return { kind: "signedOut" };
      return r.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
    },
    async write(courseId, enabled) {
      const r = await client()("teacher.course-assistant.put", { params: { courseId }, query: undefined, body: { enabled } }).catch(() => null);
      if (r === null) return { kind: "unknown" };
      if (r.ok) return { kind: "done", enabled: r.body.enabled };
      if (r.status === 401) return { kind: "signedOut" };
      if (r.status === 404) return { kind: "notFound" };
      return r.status === 422 || r.code === "client_rejected" ? { kind: "invalid" } : { kind: "unknown" };
    },
  };
}
