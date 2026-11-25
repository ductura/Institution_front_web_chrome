// WEB-V19-GRUPA: the pure rules of the teacher's team screens: the check of the setting the server also makes
// (contract: 2 to 6, and a minimum above the maximum is refused), and the lists in the only orders there are.
import { byName } from "../../student/work-team/model";
import type { Formation, Member, Person, Setting } from "./read";

export const SIZE_MIN = 2;
export const SIZE_MAX = 6;
export const SIZES: readonly number[] = [2, 3, 4, 5, 6];
export const DEFAULT_SETTING: Setting = { enabled: false, minSize: 2, maxSize: 6, formation: "student_choice" };

export type SettingDraft = { readonly enabled: boolean; readonly minSize: string; readonly maxSize: string; readonly formation: Formation };
export type SettingError = "sizeInvalid" | "minAboveMax";
export type Checked =
  | { readonly ok: true; readonly value: Setting }
  | { readonly ok: false; readonly field: "minSize" | "maxSize"; readonly error: SettingError };

export const draftOf = (setting: Setting): SettingDraft =>
  ({ enabled: setting.enabled, minSize: String(setting.minSize), maxSize: String(setting.maxSize), formation: setting.formation });

const sizeOf = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= SIZE_MIN && n <= SIZE_MAX ? n : null;
};

export function checkSetting(draft: SettingDraft): Checked {
  const minSize = sizeOf(draft.minSize);
  if (minSize === null) return { ok: false, field: "minSize", error: "sizeInvalid" };
  const maxSize = sizeOf(draft.maxSize);
  if (maxSize === null) return { ok: false, field: "maxSize", error: "sizeInvalid" };
  if (minSize > maxSize) return { ok: false, field: "minSize", error: "minAboveMax" };
  return { ok: true, value: { enabled: draft.enabled, minSize, maxSize, formation: draft.formation } };
}

export const sameSetting = (a: Setting, b: Setting): boolean =>
  a.enabled === b.enabled && a.minSize === b.minSize && a.maxSize === b.maxSize && a.formation === b.formation;

/** Members and unassigned students by family name, then given name; never by anything else. */
export const membersByName = (members: readonly Member[]): readonly Member[] => byName(members);
export const peopleByName = (people: readonly Person[]): readonly Person[] => byName(people);

/** Teams with a free place, for "add to a team": the maximum is the server's, so the page only offers what fits. */
export const hasRoom = (team: { readonly members: readonly unknown[] }, setting: Setting): boolean => team.members.length < setting.maxSize;
