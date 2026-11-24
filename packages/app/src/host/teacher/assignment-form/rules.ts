// NZ-3 and NZ-4 (WEB-NF4-ZADATAK): the choices of the form that the create route does not carry as plain fields.
// Groups, outside tools and "samo sažimanje" go in the create body (contract fields groupIds, externalToolsAllowed,
// aiSummaryOnly). Withdrawal and the declaration are separate switches of an existing assignment, so they are set
// after the create answer, each one by its own route, and a switch counts as set only when the server's answer
// names the value that was sent (B-6).
import type { createApi } from "@/client/api";

export type Call = ReturnType<typeof createApi>;
export type Group = { readonly id: string; readonly name: string };
export type GroupsRead = { readonly kind: "ready"; readonly groups: readonly Group[] } | { readonly kind: "unavailable" };

/** What the teacher chose in the sections "Rok i opseg", "Pravila o Asistentu i alatima" and "Pravila predaje". */
export type RuleChoices = {
  /** Null until the groups are read; then the ticked group ids. */
  readonly groupIds: readonly string[] | null;
  readonly summaryOnly: boolean;
  readonly externalTools: boolean;
  /** P-D3: on by default. */
  readonly withdrawal: boolean;
  /** On by default: the faculty form is always asked unless the teacher turns it off (decision 6, 23. 11.). */
  readonly declarationRequired: boolean;
};

export const defaultChoices: RuleChoices = { groupIds: null, summaryOnly: false, externalTools: true, withdrawal: true, declarationRequired: true };

const none = { query: undefined, body: undefined } as const;

/** institution.course-groups.get; a failed or odd answer is "unavailable", never an empty list. */
export async function readGroups(call: Call, courseId: string): Promise<GroupsRead> {
  try {
    const result = await call("institution.course-groups.get", { params: { courseId }, ...none });
    if (!result.ok) return { kind: "unavailable" };
    const groups = result.body.groups.map(({ id, name }) => ({ id, name }));
    return new Set(groups.map((g) => g.id)).size === groups.length ? { kind: "ready", groups } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The extra create-body fields. Groups are sent only once they are read; a course without groups sends none. */
export function bodyExtras(choices: RuleChoices): {
  groupIds?: string[]; externalToolsAllowed: boolean; aiSummaryOnly: boolean;
} {
  return {
    ...(choices.groupIds !== null && choices.groupIds.length > 0 ? { groupIds: [...choices.groupIds] } : {}),
    externalToolsAllowed: choices.externalTools,
    aiSummaryOnly: choices.summaryOnly,
  };
}

/** The group error of the form: with groups on offer, at least one must be ticked. */
export function groupsMissing(groups: GroupsRead | null, choices: RuleChoices): boolean {
  return groups?.kind === "ready" && groups.groups.length > 0 && (choices.groupIds ?? []).length === 0;
}

export type SwitchOutcome = "set" | "failed" | "signedOut";
export type RuleName = "withdrawal" | "declaration";

/** teacher.submission-withdrawal.post: set only when the answer repeats the value sent. */
export async function setWithdrawal(call: Call, assignmentId: string, allowed: boolean): Promise<SwitchOutcome> {
  try {
    const result = await call("teacher.submission-withdrawal.post", { params: { assignmentId }, query: undefined, body: { allowed } });
    if (!result.ok) return result.status === 401 ? "signedOut" : "failed";
    return result.body.allowed === allowed ? "set" : "failed";
  } catch {
    return "failed";
  }
}

/** teacher.declaration-required.put: set only when the answer repeats the value sent. */
export async function setDeclarationRequired(call: Call, assignmentId: string, required: boolean): Promise<SwitchOutcome> {
  try {
    const result = await call("teacher.declaration-required.put", { params: { assignmentId }, query: undefined, body: { required } });
    if (!result.ok) return result.status === 401 ? "signedOut" : "failed";
    return result.body.required === required ? "set" : "failed";
  } catch {
    return "failed";
  }
}

/** The switches of a new assignment that differ from the defaults, set one by one; returns the ones that failed. */
export async function applyRules(call: Call, assignmentId: string, choices: RuleChoices): Promise<RuleName[]> {
  const failed: RuleName[] = [];
  if (choices.withdrawal !== defaultChoices.withdrawal && (await setWithdrawal(call, assignmentId, choices.withdrawal)) !== "set") failed.push("withdrawal");
  if (choices.declarationRequired !== defaultChoices.declarationRequired &&
      (await setDeclarationRequired(call, assignmentId, choices.declarationRequired)) !== "set") failed.push("declaration");
  return failed;
}

/** The two switches of an existing assignment (teacher.submission-withdrawal.get, teacher.declaration-required.get). */
export type CurrentRules = { readonly withdrawal: boolean; readonly declarationRequired: boolean };

export async function readRules(call: Call, assignmentId: string): Promise<{ kind: "ready"; rules: CurrentRules } | { kind: "signedOut" | "unavailable" }> {
  try {
    const params = { assignmentId };
    const [w, d] = await Promise.all([
      call("teacher.submission-withdrawal.get", { params, ...none }),
      call("teacher.declaration-required.get", { params, ...none }),
    ]);
    if ((!w.ok && w.status === 401) || (!d.ok && d.status === 401)) return { kind: "signedOut" };
    if (!w.ok || !d.ok) return { kind: "unavailable" };
    return { kind: "ready", rules: { withdrawal: w.body.allowed, declarationRequired: d.body.required } };
  } catch {
    return { kind: "unavailable" };
  }
}
