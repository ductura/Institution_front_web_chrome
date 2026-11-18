// The settings screen over settings.catalogue.get, settings.values.get and .put,
// and the interface language over profile.interface-locale.get and .post
// (DAN-872). No import: the calls are createApi() from src/client, which the
// page passes in, so this file also type-checks inside src/client, whose test
// runs it over the contract's fake server.

export type SettingLevel = "personal" | "course" | "institution" | "system" | "network_security";
export type SettingValue = boolean | number | string;

/** One key of settings.catalogue.get, as the contract gives it. */
export type CatalogueKey = {
  key: string;
  levels: SettingLevel[];
  kind: "boolean" | "integer" | "enum";
  default: SettingValue;
  min?: number;
  max?: number;
  values?: string[];
};

type Failure = { ok: false; status: number; code: string };
type None = { params: undefined; query: undefined };
type SettingRow = { key: string; value: SettingValue | null; bound: unknown };
type Inherited = { key: string; value: SettingValue; source: SettingLevel | "default"; bound: unknown };

/** What the screen needs of createApi(): these five routes, their answers only. */
export type SettingsCall = ((id: "settings.catalogue.get", input: None & { body: undefined })
  => Promise<{ ok: true; status: 200; body: { keys: CatalogueKey[] } } | Failure>)
  & ((id: "settings.values.get", input: { params: undefined; query: { level: SettingLevel; course?: string }; body: undefined })
    => Promise<{ ok: true; status: 200; body: { values: SettingRow[]; inherited: Inherited[] } } | Failure>)
  & ((id: "settings.values.put", input: None & { body: SettingPut })
    => Promise<{ ok: true; status: 200; body: { key: string; value: SettingValue | null; changed: boolean } } | Failure>)
  & ((id: "profile.interface-locale.get", input: None & { body: undefined })
    => Promise<{ ok: true; status: 200; body: { locale: "hr" | "en" | null } } | Failure>)
  & ((id: "profile.interface-locale.post", input: None & { body: { locale: "hr" | "en" } })
    => Promise<{ ok: true; status: 200; body: { locale: "hr" | "en" } } | Failure>);

type SettingPut = {
  level: SettingLevel; course: string | null; key: string; value: SettingValue | null;
  locked: boolean; min: number | null; max: number | null;
};

/** A personal key of the catalogue with the value that holds for the caller now. */
export type PersonalSetting = CatalogueKey & { value: SettingValue };

export type SettingsRead =
  | { kind: "ready"; catalogue: CatalogueKey[]; settings: PersonalSetting[]; locale: "hr" | "en" | null }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

/** Refused before anything was sent, the same answer createApi gives. */
export const CLIENT_REJECTED = { ok: false, status: 0, code: "client_rejected" } as const;
const UNAVAILABLE = { ok: false, status: 0, code: "unavailable" } as const;
const NONE = { params: undefined, query: undefined, body: undefined };

/**
 * The catalogue, the caller's personal rows and the saved interface language,
 * read together. Any 401 reads signed out; any other failure, a broken
 * connection included, unavailable: never a screen of defaults the caller
 * did not choose. A personal row without a value falls back to what it inherits.
 */
export async function readSettings(call: SettingsCall): Promise<SettingsRead> {
  try {
    const [catalogue, values, locale] = await Promise.all([
      call("settings.catalogue.get", NONE),
      call("settings.values.get", { params: undefined, query: { level: "personal" }, body: undefined }),
      call("profile.interface-locale.get", NONE),
    ]);
    if (!catalogue.ok || !values.ok || !locale.ok) {
      return [catalogue, values, locale].some((r) => !r.ok && r.status === 401) ? { kind: "signedOut" } : { kind: "unavailable" };
    }
    const own = new Map(values.body.values.flatMap((row) => (row.value === null ? [] : [[row.key, row.value] as const])));
    const inherited = new Map(values.body.inherited.map((row) => [row.key, row.value] as const));
    const settings = catalogue.body.keys
      .filter((entry) => entry.levels.includes("personal"))
      .map((entry) => {
        // A stored value the catalogue no longer allows is not shown as if it held.
        const value = [own.get(entry.key), inherited.get(entry.key)].find((v) => v !== undefined && allowedValue(entry, v));
        return { ...entry, value: value ?? entry.default };
      });
    return { kind: "ready", catalogue: catalogue.body.keys, settings, locale: locale.body.locale };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * True when the catalogue lets the caller hold this value of this key at the
 * personal level: the key is in it (own entries only, so "__proto__" is no
 * key), the level is allowed and the value is of the key's kind and limits.
 * null removes the row, and the level above holds again.
 */
export function allowedSetting(catalogue: readonly CatalogueKey[], key: unknown, value: unknown): boolean {
  const entry = catalogue.find((candidate) => candidate.key === key);
  if (entry === undefined || !entry.levels.includes("personal")) return false;
  return value === null || allowedValue(entry, value);
}

/** True when the value is of the entry's kind and within its limits. */
function allowedValue(entry: CatalogueKey, value: unknown): boolean {
  if (entry.kind === "boolean") return typeof value === "boolean";
  if (entry.kind === "enum") return typeof value === "string" && (entry.values ?? []).includes(value);
  return Number.isSafeInteger(value) && (entry.min === undefined || (value as number) >= entry.min)
    && (entry.max === undefined || (value as number) <= entry.max);
}

/**
 * Saves one personal value. Only keys of the catalogue are saved: anything
 * else is client_rejected and the call is never made, so no request leaves
 * the browser. A broken connection reads unavailable.
 */
export async function saveSetting(call: SettingsCall, catalogue: readonly CatalogueKey[], key: unknown, value: unknown) {
  if (!allowedSetting(catalogue, key, value)) return CLIENT_REJECTED;
  const body: SettingPut = {
    level: "personal", course: null, key: key as string, value: value as SettingValue | null, locked: false, min: null, max: null,
  };
  try {
    return await call("settings.values.put", { params: undefined, query: undefined, body });
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Saves the interface language. Only a registered locale (locale.ts,
 * INTERFACE_LOCALES, passed in by the page) is sent, exactly as it is: "HR",
 * "hr-HR" or "de" are client_rejected without a request.
 */
export async function saveInterfaceLocale(call: SettingsCall, registered: readonly string[], locale: unknown) {
  if (typeof locale !== "string" || !registered.includes(locale) || (locale !== "hr" && locale !== "en")) return CLIENT_REJECTED;
  try {
    return await call("profile.interface-locale.post", { params: undefined, query: undefined, body: { locale } });
  } catch {
    return UNAVAILABLE;
  }
}
