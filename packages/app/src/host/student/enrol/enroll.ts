// WEB-2113: the student host's own copy of src/components/student/upis/enroll.ts.
import { createApi } from "@/client/api";

// WEB-11 (E-5, A-2): the student joins a course with the teacher's code over
// student.enrollments.post. The browser sends only the code; identity and
// institution come from the session, and the server normalizes the code again.
export type EnrollResult =
  | { kind: "enrolled" | "alreadyEnrolled" | "noAssignment"; courseId: string }
  | {
      kind: "malformed" | "invalidCode" | "expiredCode" | "tooManyAttempts" | "signedOut" | "forbidden" | "invalid" |
        "unavailable" | "offline";
    };

type Api = ReturnType<typeof createApi>;

/** The code as the server compares it: no spaces or hyphens, upper case; null if it can never match. */
export function normalizeCode(input: string): string | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-Z]{8,32}$/.test(code) ? code : null;
}

const OUTCOMES = { enrolled: "enrolled", already_enrolled: "alreadyEnrolled", enrolled_no_assignment: "noAssignment" } as const;

/** One enrollment attempt; a code that can never match is not sent, so it spends no attempt. */
export async function enroll(input: string, api: Api = createApi()): Promise<EnrollResult> {
  const code = normalizeCode(input);
  if (!code) return { kind: "malformed" };
  let result: Awaited<ReturnType<Api>>;
  try {
    result = await api("student.enrollments.post", { params: undefined, query: undefined, body: { code } });
  } catch {
    // The request never reached the server: the connection, not the code.
    return { kind: "offline" };
  }
  if (result.ok) {
    const body = result.body as { outcome: keyof typeof OUTCOMES; courseId: string };
    return { kind: OUTCOMES[body.outcome], courseId: body.courseId };
  }
  switch (result.code) {
    case "invalid_code":
    case "invalid_input":
      return { kind: "invalidCode" };
    case "expired_code":
      return { kind: "expiredCode" };
    case "too_many_attempts":
    case "too_many_requests":
      return { kind: "tooManyAttempts" };
    case "unauthorized":
    case "session_expired":
      return { kind: "signedOut" };
    case "forbidden":
      return { kind: "forbidden" };
    case "client_rejected":
      return { kind: "malformed" };
    case "unavailable":
    case "unexpected":
      return { kind: "unavailable" };
    default:
      // Origin, body and media type refusals: the request itself, not the code.
      return result.status >= 400 && result.status < 500 ? { kind: "invalid" } : { kind: "unavailable" };
  }
}
