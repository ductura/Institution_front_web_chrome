// WEB-20 (Ductus#2028): the rules of the "Novi kolegij" form, without React,
// on the limits of institution.admin-courses.post.

export const AI_POLICIES = ["prohibited", "partially_allowed", "encouraged"] as const;
export type AiPolicy = (typeof AI_POLICIES)[number];

export type NewCourseFields = {
  readonly name: string;
  readonly academicYear: string;
  readonly aiPolicy: string;
  readonly holderId: string;
  /** One group per line. */
  readonly groups: string;
};

export type NewCourseInput = {
  name: string;
  academicYear: string;
  aiPolicy: AiPolicy;
  holderId: string;
  groups: string[];
};

export type FieldError =
  | "nameRequired" | "nameTooLong"
  | "groupsTooMany" | "groupTooLong" | "groupDuplicate";

/** holderId has no text of its own: the holder field says why no teacher can be chosen. */
export type FieldErrors = Partial<Record<"name" | "academicYear" | "aiPolicy" | "groups", FieldError>> & { holderId?: "holderInvalid" };

export const NAME_MAX = 160;
export const GROUP_MAX = 80;
export const GROUPS_MAX = 20;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const YEAR = /^[0-9]{4}\/[0-9]{4}$/;

/** The academic year running on `now` (from 1 October) and the next one, e.g. ["2026/2027", "2027/2028"]. */
export function academicYears(now: Date): [string, string] {
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return [`${start}/${start + 1}`, `${start + 1}/${start + 2}`];
}

/** Length in code points, as the contract's maxLength counts. */
const length = (value: string): number => [...value].length;

/** The form, checked: the body for the contract or the errors to show next to the fields. */
export function newCourseInput(fields: NewCourseFields): { ok: true; input: NewCourseInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "nameRequired";
  else if (length(name) > NAME_MAX) errors.name = "nameTooLong";
  const holderId = fields.holderId.trim();
  if (!UUID.test(holderId)) errors.holderId = "holderInvalid";
  const groups = fields.groups.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  if (groups.length > GROUPS_MAX) errors.groups = "groupsTooMany";
  else if (groups.some((group) => length(group) > GROUP_MAX)) errors.groups = "groupTooLong";
  else if (new Set(groups.map((group) => group.toLocaleLowerCase("hr"))).size !== groups.length) errors.groups = "groupDuplicate";
  const aiPolicy = AI_POLICIES.find((policy) => policy === fields.aiPolicy);
  // Both come from fixed options; a value outside them is a broken page, not a user error.
  if (aiPolicy === undefined || !YEAR.test(fields.academicYear)) return { ok: false, errors };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, academicYear: fields.academicYear, aiPolicy, holderId, groups } };
}

export type CreateOutcome = "created" | "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";

/** What the form says after the server's answer (or the client's refusal). */
export function createOutcome(result: { readonly ok: boolean; readonly status: number; readonly code?: string }): CreateOutcome {
  if (result.ok) return "created";
  if (result.status === 401) return "signedOut";
  if (result.status === 403 && result.code === "forbidden") return "forbidden";
  if (result.status === 409) return "conflict";
  if (result.status === 422 || result.code === "client_rejected") return "invalid";
  return "unavailable";
}
