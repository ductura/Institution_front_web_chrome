// WEB-V16-OBRASCI: reads of the work's forms and the mentor's consent, parsed by hand from the server's answer
// (a wrong shape is "unavailable", never an empty list). A 404 on either read is "notFound": the work is
// another's or has no mentorship, so the section is hidden by the frame.
import type { createApi } from "../../../../../../src/client/api";
import type { SectionRead } from "../model";

export type Call = ReturnType<typeof createApi>;
export type FormState = "not_submitted" | "submitted" | "accepted";
export type Part = "student" | "mentor" | "faculty";
export type ThesisForm = { code: string; title: string; state: FormState; changedAt: string | null; changedByPart: Part | null };
export type ConsentState = "none" | "given" | "withdrawn";
export type ConsentEntry = { given: boolean; changedAt: string; comment: string | null };
export type Consent = { state: ConsentState; comment: string | null; changedAt: string | null; requiredForSubmission: boolean; history: ConsentEntry[] };
export type FormsValue = { forms: ThesisForm[]; consent: Consent };

const STATES: readonly string[] = ["not_submitted", "submitted", "accepted"];
const PARTS: readonly string[] = ["student", "mentor", "faculty"];
const CONSENTS: readonly string[] = ["none", "given", "withdrawn"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strOrNull = (v: unknown): string | null | undefined => (v === null || typeof v === "string" ? v : undefined);

export function parseForm(v: unknown): ThesisForm | null {
  if (!isObj(v) || typeof v.code !== "string" || typeof v.title !== "string" || typeof v.state !== "string" || !STATES.includes(v.state)) return null;
  const at = strOrNull(v.changedAt);
  const part = v.changedByPart === null ? null : typeof v.changedByPart === "string" && PARTS.includes(v.changedByPart) ? (v.changedByPart as Part) : undefined;
  if (at === undefined || part === undefined) return null;
  return { code: v.code, title: v.title, state: v.state as FormState, changedAt: at, changedByPart: part };
}

export function parseForms(v: unknown): ThesisForm[] | null {
  if (!isObj(v) || !Array.isArray(v.forms)) return null;
  const forms = v.forms.map(parseForm);
  return forms.every((f): f is ThesisForm => f !== null) ? forms : null;
}

export function parseConsent(v: unknown): Consent | null {
  if (!isObj(v) || typeof v.state !== "string" || !CONSENTS.includes(v.state) || typeof v.requiredForSubmission !== "boolean" || !Array.isArray(v.history)) return null;
  const comment = strOrNull(v.comment);
  const changedAt = strOrNull(v.changedAt);
  if (comment === undefined || changedAt === undefined) return null;
  const history: ConsentEntry[] = [];
  for (const h of v.history) {
    if (!isObj(h) || typeof h.given !== "boolean" || typeof h.changedAt !== "string") return null;
    const c = strOrNull(h.comment);
    if (c === undefined) return null;
    history.push({ given: h.given, changedAt: h.changedAt, comment: c });
  }
  return { state: v.state as ConsentState, comment, changedAt, requiredForSubmission: v.requiredForSubmission, history };
}

type Answer = { ok: true; body: unknown } | { ok: false; status: number };

/** Reads forms and consent together; one 404 hides the section, any other failure is "unavailable". */
export async function readForms(call: Call, documentId: string): Promise<SectionRead<FormsValue>> {
  const params = { documentId };
  const [forms, consent] = (await Promise.all([
    call("work.thesis-forms.get", { params, query: undefined, body: undefined }),
    call("work.mentor-consent.get", { params, query: undefined, body: undefined }),
  ])) as [Answer, Answer];
  if ((!forms.ok && forms.status === 404) || (!consent.ok && consent.status === 404)) return { kind: "notFound" };
  if (!forms.ok || !consent.ok) return { kind: "unavailable" };
  const f = parseForms(forms.body);
  const c = parseConsent(consent.body);
  if (f === null || c === null) return { kind: "unavailable" };
  if (f.length === 0 && c.state === "none" && c.history.length === 0) return { kind: "empty" };
  return { kind: "ready", value: { forms: f, consent: c } };
}
