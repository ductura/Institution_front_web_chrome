import { createApi, type ApiOptions } from "@/client/api";

import { changedFields, validateRules, type Rules, type Version } from "./rules";

type Config = { current: Version | null; versions: readonly Version[] };
type Denied = { kind: "denied" };
export type ConfigRead = { kind: "ready"; data: Config } | Denied | { kind: "unavailable" };
type Publish = { kind: "published"; version: Version } | Denied | { kind: "invalid" | "conflict" | "unknown" };

const denied: Denied = { kind: "denied" };
const emptyInput = { params: undefined, query: undefined, body: undefined };

function validVersion(version: Version) {
  return Number.isFinite(Date.parse(version.effectiveFrom)) && validateRules(version.rules) === null
    && new Set(version.rules.workLanguages).size === version.rules.workLanguages.length;
}

export async function readConfig(options?: ApiOptions): Promise<ConfigRead> {
  try {
    const result = await createApi(options)("institution.config.get", emptyInput);
    if (!result.ok) {
      return result.status === 401 || result.status === 403 ? denied : { kind: "unavailable" };
    }
    const { current, versions } = result.body;
    const latest = versions.at(-1);
    const matchesLatest = latest === undefined ? current === null : current !== null
      && current.version === latest.version && current.effectiveFrom === latest.effectiveFrom
      && validVersion(current) && changedFields(latest.rules, current.rules).length === 0;
    if (matchesLatest && versions.every((version, index) => validVersion(version)
      && (index === 0 || version.version > versions[index - 1]!.version))) {
      return { kind: "ready", data: result.body };
    }
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}

export async function publishRules(expectedVersion: number, rules: Rules, options?: ApiOptions): Promise<Publish> {
  try {
    const result = await createApi(options)("institution.config-versions.post", {
      ...emptyInput,
      body: { ...rules, workLanguages: [...rules.workLanguages], expectedVersion },
    });
    if (!result.ok) {
      if (result.status === 401 || (result.status === 403 && result.code === "forbidden")) return denied;
      if (result.status === 422 && result.code === "invalid_input") return { kind: "invalid" };
      if (result.status === 409 && result.code === "conflict") return { kind: "conflict" };
    } else if (result.body.version === expectedVersion + 1 && validVersion(result.body)
      && changedFields(rules, result.body.rules).length === 0) {
      return { kind: "published", version: result.body };
    }
  } catch {
    return { kind: "unknown" };
  }
  return { kind: "unknown" };
}
