// MEN-R04 (MEN-31): the faculty's list of thesis forms and the mentor-consent switch, read only.
//   institution.thesis-forms.get    -> 200 { forms: [{ code, version, title, workTypes, active, publishedAt }] }
//   institution.thesis-settings.get -> 200 { mentorConsentRequired, changedAt }
// A wrong shape is "unavailable", never an empty list or a switched-off switch.
import { createApi, type ApiOptions } from "@/client/api";

import type { Part } from "./read";

export const THESIS_WORK_TYPES = ["bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"] as const;
export type ThesisWorkType = (typeof THESIS_WORK_TYPES)[number];
export type ThesisFormRow = { code: string; version: number; title: string; workTypes: readonly ThesisWorkType[]; active: boolean; publishedAt: string };
export type ThesisSettings = { mentorConsentRequired: boolean; changedAt: string | null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isWorkType = (v: unknown): v is ThesisWorkType => typeof v === "string" && (THESIS_WORK_TYPES as readonly string[]).includes(v);

export function parseThesisForms(v: unknown): ThesisFormRow[] | null {
  if (!isObj(v) || !Array.isArray(v.forms)) return null;
  const rows: ThesisFormRow[] = [];
  for (const f of v.forms) {
    if (!isObj(f) || typeof f.code !== "string" || typeof f.title !== "string" || typeof f.active !== "boolean"
      || typeof f.version !== "number" || !Number.isInteger(f.version) || typeof f.publishedAt !== "string"
      || !Array.isArray(f.workTypes) || f.workTypes.length === 0 || !f.workTypes.every(isWorkType)) return null;
    rows.push({ code: f.code, version: f.version, title: f.title, workTypes: f.workTypes, active: f.active, publishedAt: f.publishedAt });
  }
  return rows;
}

export function parseThesisSettings(v: unknown): ThesisSettings | null {
  if (!isObj(v) || typeof v.mentorConsentRequired !== "boolean") return null;
  if (v.changedAt !== null && typeof v.changedAt !== "string") return null;
  return { mentorConsentRequired: v.mentorConsentRequired, changedAt: v.changedAt };
}

async function readPart<T>(run: () => Promise<{ ok: boolean; status: number; body?: unknown }>, parse: (body: unknown) => T | null): Promise<Part<T>> {
  try {
    const answer = await run();
    if (answer.ok) {
      const value = parse(answer.body);
      return value === null ? { kind: "unavailable" } : { kind: "ready", value };
    }
    if (answer.status === 401) return { kind: "signedOut" };
    if (answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export const readThesisFormsPart = (options?: ApiOptions): Promise<Part<readonly ThesisFormRow[]>> =>
  readPart(() => createApi(options)("institution.thesis-forms.get", { params: undefined, query: undefined, body: undefined }), parseThesisForms);

export const readThesisSettingsPart = (options?: ApiOptions): Promise<Part<ThesisSettings>> =>
  readPart(() => createApi(options)("institution.thesis-settings.get", { params: undefined, query: undefined, body: undefined }), parseThesisSettings);

/** Forms in force: active ones counted apart from the withdrawn ones. */
export const summariseThesisForms = (rows: readonly ThesisFormRow[]) => ({ active: rows.filter((r) => r.active).length, total: rows.length });
