export const languages = ["hr", "en"] as const;
export type Language = (typeof languages)[number];

export type Rules = {
  readonly citationStyle: "fpzg";
  readonly workLanguages: readonly Language[];
  readonly defaultWorkLanguage: Language;
};

export type Version = {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly rules: Rules;
};

export const ruleFields = ["citationStyle", "workLanguages", "defaultWorkLanguage"] as const;

export function validateRules(rules: Rules) {
  if (rules.workLanguages.length === 0) return "workLanguages";
  if (!rules.workLanguages.includes(rules.defaultWorkLanguage)) return "defaultWorkLanguage";
  return null;
}

export function changedFields(previous: Rules | undefined, next: Rules) {
  if (previous === undefined) return ruleFields;
  return ruleFields.filter((field) => {
    if (field === "workLanguages") {
      return languages.some((language) => previous.workLanguages.includes(language) !== next.workLanguages.includes(language));
    }
    return previous[field] !== next[field];
  });
}
