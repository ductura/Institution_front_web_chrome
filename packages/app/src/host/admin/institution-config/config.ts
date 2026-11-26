import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const READ = "institution.config.get";
const PUBLISH = "institution.config-versions.post";

type ReadBody = Extract<ApiResult<typeof READ>, { ok: true }>["body"];
export type ConfigVersion = ReadBody["versions"][number];
export type ConfigRules = ConfigVersion["rules"];
export type WorkLanguage = ConfigRules["workLanguages"][number];
export type CitationStyle = ConfigRules["citationStyle"];

export const WORK_LANGUAGES: readonly WorkLanguage[] = ["hr", "en"];

/** What the administrator edits: the content of a version, never its number or time. */
export type ConfigDraft = { workLanguages: readonly WorkLanguage[]; defaultWorkLanguage: WorkLanguage };
export type ConfigField = "workLanguages" | "defaultWorkLanguage" | "form";
export type ConfigErrors = Partial<Record<ConfigField, string>>;

export type ConfigRead =
  | { kind: "ready"; current: ConfigVersion | null; versions: readonly ConfigVersion[] }
  | { kind: "denied" | "unavailable" };

export const NO_CONFIG: ConfigDraft = { workLanguages: ["hr"], defaultWorkLanguage: "hr" };

/** The version in force: the highest number, whatever the order of the list. */
export function newestOf(versions: readonly ConfigVersion[]): ConfigVersion | null {
  return versions.length === 0 ? null : versions.reduce((a, b) => (b.version > a.version ? b : a));
}

export const draftOf = (version: ConfigVersion | null): ConfigDraft =>
  version === null ? NO_CONFIG : { workLanguages: [...version.rules.workLanguages], defaultWorkLanguage: version.rules.defaultWorkLanguage };

const ordered = (languages: readonly WorkLanguage[]) => WORK_LANGUAGES.filter((l) => languages.includes(l));

export type ConfigChange = { field: "workLanguages" | "defaultWorkLanguage"; before: readonly WorkLanguage[] | WorkLanguage | null; after: readonly WorkLanguage[] | WorkLanguage };

/** The fields in which the draft differs from the version in force; with no version, both are new. */
export function configChanges(current: ConfigVersion | null, draft: ConfigDraft): ConfigChange[] {
  const before = current === null ? null : draftOf(current);
  const out: ConfigChange[] = [];
  const languages = ordered(draft.workLanguages);
  if (before === null || ordered(before.workLanguages).join() !== languages.join()) {
    out.push({ field: "workLanguages", before: before === null ? null : ordered(before.workLanguages), after: languages });
  }
  if (before === null || before.defaultWorkLanguage !== draft.defaultWorkLanguage) {
    out.push({ field: "defaultWorkLanguage", before: before?.defaultWorkLanguage ?? null, after: draft.defaultWorkLanguage });
  }
  return out;
}

/** The check before sending; the server checks again. */
export function checkConfig(draft: ConfigDraft, say: { languagesNeeded: string; defaultNotChosen: string }): ConfigErrors {
  if (draft.workLanguages.length === 0) return { workLanguages: say.languagesNeeded };
  if (!draft.workLanguages.includes(draft.defaultWorkLanguage)) return { defaultWorkLanguage: say.defaultNotChosen };
  return {};
}

export async function readConfig(options?: ApiOptions): Promise<ConfigRead> {
  try {
    const answer = await createApi(options)(READ, { params: undefined, query: {}, body: undefined });
    if (answer.ok) return { kind: "ready", current: answer.body.current, versions: answer.body.versions };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export type PublishConfigResult =
  | { kind: "published"; version: number }
  | { kind: "invalid"; message: string }
  | { kind: "stale" | "denied" | "unavailable" };

/** Publishes a new version based on the one the administrator saw (0 when there is none). */
export async function publishConfig(basedOn: number | null, draft: ConfigDraft, invalid: string, options?: ApiOptions): Promise<PublishConfigResult> {
  try {
    const answer = await createApi(options)(PUBLISH, {
      params: undefined, query: undefined,
      body: { expectedVersion: basedOn ?? 0, citationStyle: "fpzg", workLanguages: ordered(draft.workLanguages), defaultWorkLanguage: draft.defaultWorkLanguage },
    });
    if (answer.ok) return { kind: "published", version: answer.body.version };
    if (answer.status === 422 || answer.status === 0) return { kind: "invalid", message: invalid };
    if (answer.status === 409) return { kind: "stale" };
    if (answer.status === 401 || answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
