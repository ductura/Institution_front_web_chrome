// WEB-V19-GRUPA: the pure rules of the team screens. Names are always in the order of the alphabet and
// categories in the fixed order of the contract; nothing here sorts, compares, ranks or marks by an amount
// (val19-razlika §8), and there is no share, mean or threshold.
import type { Category, ContributionView, TeamView } from "./read";

export const CATEGORY_ORDER: readonly Category[] = ["written", "ai_transferred", "pasted", "imported", "unattributed"];

type Named = { readonly givenName: string; readonly familyName: string };
const collator = new Intl.Collator("hr", { sensitivity: "base", numeric: true });

/** Family name, then given name: the only order in which people are listed. */
export function byName<T extends Named>(people: readonly T[]): readonly T[] {
  return [...people].sort((a, b) => collator.compare(a.familyName, b.familyName) || collator.compare(a.givenName, b.givenName));
}

export const fullName = (p: Named): string => `${p.givenName} ${p.familyName}`.trim();

/** The categories in the contract's order, whatever the order or the gaps of the answer; a missing one is 0. */
export function categoriesInOrder(categories: readonly { readonly category: Category; readonly codePoints: number }[]): readonly { readonly category: Category; readonly codePoints: number }[] {
  return CATEGORY_ORDER.map((category) => ({ category, codePoints: categories.find((c) => c.category === category)?.codePoints ?? 0 }));
}

/** The state of the screen that is "no team yet": the student may create or join only when the students form the teams. */
export const mayFormTeam = (view: TeamView): boolean => view.state === "none" && view.formation === "student_choice";

export const isReady = (view: ContributionView): view is Extract<ContributionView, { state: "ready" }> => view.state === "ready";

/** "1 234" in the Croatian grouping. */
export const countOf = (n: number): string => new Intl.NumberFormat("hr-HR").format(n);

export function plural(n: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? forms.one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
