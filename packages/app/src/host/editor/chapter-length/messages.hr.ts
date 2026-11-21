const numbers = new Intl.NumberFormat("hr-HR");
const plurals = new Intl.PluralRules("hr-HR");

export const chapterLengthHr = {
  words: (count: number) => `${numbers.format(count)} ${plurals.select(count) === "one" ? "riječ" : "riječi"}`,
  range: (min: number, max: number) => `cilj ${numbers.format(min)}–${numbers.format(max)} riječi`,
  minimum: (min: number) => `cilj od ${numbers.format(min)} riječi`,
  maximum: (max: number) => `cilj do ${numbers.format(max)} riječi`,
};
