import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const READ = "institution.faculty-rules.get";
const PUBLISH = "institution.faculty-rules.post";

type ReadBody = Extract<ApiResult<typeof READ>, { ok: true }>["body"];
export type RuleRow = ReadBody["rules"][number];
export type RuleVersion = RuleRow["versions"][number];
export type WorkType = RuleRow["workType"];
export type AiPolicy = RuleVersion["aiPolicy"];
export type AiPurpose = RuleVersion["aiPurposes"][number];
export type EvidenceProfile = RuleVersion["evidenceProfile"];

export const AI_POLICIES: readonly AiPolicy[] = ["prohibited", "partially_allowed", "encouraged"];
export const AI_PURPOSES: readonly AiPurpose[] = ["formatting", "proofreading", "literature_search", "transcription", "translation"];
export const PROFILES: readonly EvidenceProfile[] = ["basic", "extended"];

/** What the administrator edits: the content of a version, never its number, origin or time. */
export type RuleDraft = {
  aiPolicy: AiPolicy;
  aiPurposes: readonly AiPurpose[];
  evidenceProfile: EvidenceProfile;
  importAllowed: boolean;
};

export type RuleField = "aiPolicy" | "aiPurposes" | "evidenceProfile" | "importAllowed" | "form";
export type FieldErrors = Partial<Record<RuleField, string>>;

export type RulesRead =
  | { kind: "ready"; rules: readonly RuleRow[] }
  | { kind: "denied" | "unavailable" };

/** The newest version of a work type: the one in force. Versions only ever grow, so it is the last. */
export function currentOf(row: RuleRow): RuleVersion | null {
  return row.versions.length === 0 ? null : row.versions.reduce((a, b) => (b.versionNo > a.versionNo ? b : a));
}

/** The previous version, the one the new version replaces and is compared with. */
export const draftOf = (version: RuleVersion | null): RuleDraft =>
  version === null
    ? { aiPolicy: "prohibited", aiPurposes: [], evidenceProfile: "basic", importAllowed: false }
    : { aiPolicy: version.aiPolicy, aiPurposes: [...version.aiPurposes], evidenceProfile: version.evidenceProfile, importAllowed: version.importAllowed };

export type DraftChange = { field: Exclude<RuleField, "form">; before: RuleDraft[Exclude<RuleField, "form">] | null; after: RuleDraft[Exclude<RuleField, "form">] };
const FIELDS = ["aiPolicy", "aiPurposes", "evidenceProfile", "importAllowed"] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (purposes: readonly AiPurpose[]) => AI_PURPOSES.filter((purpose) => purposes.includes(purpose));

/** The fields in which the draft differs from the version in force; with no version, every field is new. */
export function changesOf(current: RuleVersion | null, draft: RuleDraft): DraftChange[] {
  const before = current === null ? null : draftOf(current);
  return FIELDS.flatMap((field) => {
    const after = field === "aiPurposes" ? sorted(draft.aiPurposes) : draft[field];
    const was = before === null ? null : field === "aiPurposes" ? sorted(before.aiPurposes) : before[field];
    return before !== null && same(was, after) ? [] : [{ field, before: was, after } as DraftChange];
  });
}

/**
 * The check before sending. It only keeps out what the server would refuse
 * anyway (the server checks again): a purpose with a policy that allows none.
 */
export function checkDraft(draft: RuleDraft, say: { purposesWithProhibited: string; purposesNeeded: string }): FieldErrors {
  if (draft.aiPolicy === "prohibited" && draft.aiPurposes.length > 0) return { aiPurposes: say.purposesWithProhibited };
  if (draft.aiPolicy === "partially_allowed" && draft.aiPurposes.length === 0) return { aiPurposes: say.purposesNeeded };
  return {};
}

export async function readRules(options?: ApiOptions): Promise<RulesRead> {
  try {
    const answer = await createApi(options)(READ, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return { kind: "ready", rules: answer.body.rules };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export type PublishResult =
  | { kind: "published"; versionNo: number }
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "stale" | "denied" | "unavailable" };

const FIELD_OF_CODE: Readonly<Record<string, RuleField>> = {
  invalid_ai_policy: "aiPolicy",
  invalid_ai_purposes: "aiPurposes",
  invalid_evidence_profile: "evidenceProfile",
};

/**
 * Publishes a new version based on the one the administrator saw. A 422 names
 * its field by its code, so the refusal is shown beside that field; a code
 * that names none is shown for the form.
 */
export async function publishRule(
  workType: WorkType, basedOn: number | null, draft: RuleDraft, say: { invalid: string; fields: Readonly<Record<string, string>> },
  options?: ApiOptions,
): Promise<PublishResult> {
  try {
    const answer = await createApi(options)(PUBLISH, {
      params: undefined, query: undefined,
      body: {
        workType, basedOnVersionNo: basedOn, aiPolicy: draft.aiPolicy, aiPurposes: sorted(draft.aiPurposes),
        evidenceProfile: draft.evidenceProfile, importAllowed: draft.importAllowed,
      },
    });
    if (answer.ok) return { kind: "published", versionNo: answer.body.versionNo };
    if (answer.status === 422 || answer.status === 0) {
      const field = FIELD_OF_CODE[answer.code] ?? "form";
      return { kind: "invalid", errors: { [field]: say.fields[field] ?? say.invalid } };
    }
    if (answer.status === 409) return { kind: "stale" };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
