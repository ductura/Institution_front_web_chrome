import { createApi, type ApiOptions } from "@/client/api";

const DEFAULT_SETTINGS = { styleId: "fpzg", profileId: null };

export async function readInstitutionCitationSettings(options: ApiOptions = {}): Promise<{
  styleId: string;
  profileId: string | null;
}> {
  try {
    const response = await createApi(options)("settings.values.get", {
      params: undefined, query: { level: "institution" }, body: undefined,
    });
    if (!response.ok || response.body.level !== "institution" || response.body.course !== null) {
      return DEFAULT_SETTINGS;
    }
    const { values, inherited } = response.body;
    const setting = (key: string) => {
      const explicit = values.find((row) => row.key === key)?.value;
      const fallback = inherited.find((row) => row.key === key)?.value;
      return typeof explicit === "string" && explicit ? explicit
        : typeof fallback === "string" && fallback ? fallback : null;
    };
    return { styleId: setting("citation.style") ?? DEFAULT_SETTINGS.styleId, profileId: setting("lekta.profile") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
