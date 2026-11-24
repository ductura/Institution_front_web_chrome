import { fetchRetention, type RetentionClassRow } from "@/client/retention";
import { createApi } from "@/client/api";

import { readThresholds, ORIGIN_KINDS, type OriginThreshold, type ThresholdCall } from "../../institution/origin-thresholds/contract";
import { currentOf, readRules, type RuleRow, type RuleVersion } from "../institution-config/rules";

export const WORK_TYPES = ["short_paper", "essay", "seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"] as const;

/** One card's read: a refusal never hides the other cards. */
export type Part<T> = { readonly kind: "ready"; readonly value: T } | { readonly kind: "signedOut" | "denied" | "unavailable" };

export const readRulesPart = async (): Promise<Part<readonly RuleRow[]>> => {
  const out = await readRules();
  return out.kind === "ready" ? { kind: "ready", value: out.rules } : out.kind === "denied" ? { kind: "denied" } : { kind: "unavailable" };
};

export const readThresholdsPart = async (): Promise<Part<readonly OriginThreshold[]>> => {
  const out = await readThresholds(createApi() as unknown as ThresholdCall);
  return out.kind === "ready" ? { kind: "ready", value: out.thresholds } : { kind: out.kind };
};

export const readRetentionPart = async (): Promise<Part<readonly RetentionClassRow[]>> => {
  const out = await fetchRetention();
  return out.kind === "ok" ? { kind: "ready", value: out.classes } : { kind: out.kind };
};

export type RulesSummary = { published: number; total: number; latest: RuleVersion | null };

/** How many work types have a rule, and the newest version over all of them (the last change). */
export function summariseRules(rows: readonly RuleRow[]): RulesSummary {
  const current = rows.flatMap((row) => { const v = currentOf(row); return v === null ? [] : [v]; });
  const latest = current.reduce<RuleVersion | null>((a, b) => (a === null || b.publishedAt > a.publishedAt ? b : a), null);
  return { published: current.length, total: WORK_TYPES.length, latest };
}

export const summariseThresholds = (rows: readonly OriginThreshold[]) => ({
  set: new Set(rows.map((row) => row.origin)).size, total: ORIGIN_KINDS.length,
});

/** Classes with a decided period; "never deleted" counts as decided, a null period does not. */
export const summariseRetention = (rows: readonly RetentionClassRow[]) => ({
  decided: rows.filter((row) => row.retentionDays !== null).length, total: rows.length,
  awaiting: rows.some((row) => row.retentionDays === null),
});

export type AssistantRow = { workType: (typeof WORK_TYPES)[number]; version: RuleVersion | null };

/** One row per work type, in the fixed order, with the version in force (null when no rule is published). */
export function assistantRows(rows: readonly RuleRow[]): AssistantRow[] {
  return WORK_TYPES.map((workType) => {
    const row = rows.find((r) => r.workType === workType);
    return { workType, version: row === undefined ? null : currentOf(row) };
  });
}
