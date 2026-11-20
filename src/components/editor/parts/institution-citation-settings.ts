import { createApi, type ApiOptions } from "@/client/api";
import { parseCitationStyle, type CitationStyle } from "@/domain/citation/style";
import fpzgConfig from "../../../../config/faculties/fpzg/citation.json";

const fpzgStyle = parseCitationStyle(fpzgConfig);
const DEFAULT_SETTINGS = { styleId: "fpzg", profileId: null, formattingStyle: fpzgStyle };

export async function readInstitutionCitationSettings(options: ApiOptions = {}): Promise<{
  styleId: string;
  profileId: string | null;
  formattingStyle: CitationStyle | null;
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
    const styleId = setting("citation.style") ?? DEFAULT_SETTINGS.styleId;
    return { styleId, profileId: setting("lekta.profile"), formattingStyle: styleId === "fpzg" ? fpzgStyle : null };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
