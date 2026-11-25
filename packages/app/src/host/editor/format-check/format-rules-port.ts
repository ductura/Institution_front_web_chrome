// WEB-V17-FORMAT-CHECK: the assignment's format rules (student.assignment-format-rules.get) over the shared client.
import { createApi } from "../../../../../../src/client/api.ts";

import type { FormatRules } from "./format-check";

export type RulesRead =
  | { readonly kind: "ready"; readonly rules: FormatRules }
  | { readonly kind: "signIn" | "notFound" | "unavailable" };

type Answer = { ok: true; body: unknown } | { ok: false; status?: number; code?: string };
export type ReadRules = (assignmentId: string) => Promise<Answer>;

const readRules: ReadRules = (assignmentId) => createApi()("student.assignment-format-rules.get", {
  params: { assignmentId }, query: {}, body: undefined,
}) as ReturnType<ReadRules>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const limit = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 1);
const text = (value: unknown) => value === null || (typeof value === "string" && value !== "");

/** A body that is not the contract's shape is `unavailable`, never an empty rule set that would show "all fine". */
export function rulesOf(body: unknown): FormatRules | null {
  if (!isRecord(body)) return null;
  const { wordMin, wordMax, minSources, requiredSections, citationStyle, font, size, spacing } = body;
  if (!limit(wordMin) || !limit(wordMax) || !limit(size) || !limit(spacing) || !text(font)) return null;
  if (typeof minSources !== "number" || !Number.isInteger(minSources) || minSources < 0) return null;
  if (!Array.isArray(requiredSections) || !requiredSections.every((s) => typeof s === "string" && s.trim() !== "")) return null;
  if (citationStyle !== "fpzg") return null;
  return { wordMin, wordMax, minSources, requiredSections, citationStyle, font, size, spacing } as FormatRules;
}

/** Someone else's assignment answers 404 like a missing one (`notFound`). */
export async function readFormatRules(assignmentId: string, read: ReadRules = readRules): Promise<RulesRead> {
  const result: Answer = await read(assignmentId).catch((): Answer => ({ ok: false }));
  if (result.ok) {
    const rules = rulesOf(result.body);
    return rules === null ? { kind: "unavailable" } : { kind: "ready", rules };
  }
  if (result.status === 401) return { kind: "signIn" };
  if (result.status === 404) return { kind: "notFound" };
  return { kind: "unavailable" };
}
