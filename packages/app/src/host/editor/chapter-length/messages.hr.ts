const numbers = new Intl.NumberFormat("hr-HR");
const plurals = new Intl.PluralRules("hr-HR");

export const chapterLengthHr = {
  words: (count: number) => `${numbers.format(count)} ${plurals.select(count) === "one" ? "riječ" : "riječi"}`,
  range: (min: number, max: number) => `cilj ${numbers.format(min)}–${numbers.format(max)} riječi`,
  minimum: (min: number) => `cilj od ${numbers.format(min)} riječi`,
  maximum: (max: number) => `cilj do ${numbers.format(max)} riječi`,
  planner: {
    title: "Planer pisanja",
    noGoals: "Nema zadanog opsega po poglavljima, pa nema ni plana.",
    done: "Sva poglavlja s najmanjim opsegom dosegla su cilj.",
    noDeadline: (remaining: number) => `Nedostaje još ${numbers.format(remaining)} riječi. Rok predaje nije dostupan, pa dnevni plan nije moguć.`,
    late: (remaining: number, daysLate: number) => `Rok je prošao prije ${daysLate} ${daysLate === 1 ? "dan" : "dana"}, a nedostaje još ${numbers.format(remaining)} riječi.`,
    plan: (remaining: number, days: number, perDay: number) => `Nedostaje još ${numbers.format(remaining)} riječi, a do roka ${days} ${days === 1 ? "dan" : "dana"}: oko ${numbers.format(perDay)} riječi dnevno.`,
    chapter: (label: string, remaining: number) => `${label}: još ${numbers.format(remaining)} riječi`,
    chapterOver: (label: string) => `${label}: iznad najvećeg opsega`,
    chapterMet: (label: string) => `${label}: cilj je dosegnut`,
  },
};
