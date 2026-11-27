import { editorHelpHr } from "../../../lib/i18n/messages.hr";

export const warnings = editorHelpHr.warnings;
export type Warning = keyof typeof warnings;
export type Level = keyof typeof editorHelpHr.levels;
export const warningKeys = Object.keys(warnings) as Warning[];
const presets: Record<Exclude<Level, "custom">, readonly Warning[]> = {
  calm: ["cmt"],
  basic: ["paste", "claim", "term", "abbr", "long", "cmt"],
  all: warningKeys,
};
export const settingsKey = "ductura:editor-help";
/** ED-82: told on the window when the settings change, so the hints in the text follow at once. */
export const HELP_CHANGED = "ductura:editor-help-changed";
export type HelpSettings = { enabled: readonly Warning[]; level: Level };
export const defaultHelp: HelpSettings = { enabled: presets.basic, level: "basic" };

export function levelOf(enabled: readonly Warning[]): Level {
  return (Object.keys(presets) as (keyof typeof presets)[])
    .find((level) => presets[level].length === enabled.length && presets[level].every((key) => enabled.includes(key))) ?? "custom";
}

export function forLevel(level: Level, enabled: readonly Warning[]): readonly Warning[] {
  return level === "custom" ? enabled : presets[level];
}

export function toggleWarning(enabled: readonly Warning[], key: Warning): readonly Warning[] {
  return enabled.includes(key) ? enabled.filter((warning) => warning !== key) : [...enabled, key];
}

export function readHelp(read: () => string | null): HelpSettings {
  try {
    const value = JSON.parse(read() ?? "null") as { enabled?: unknown; level?: unknown } | null;
    if (Array.isArray(value?.enabled) && value.enabled.every((entry) => warningKeys.includes(entry))) {
      const enabled = Array.from(new Set<Warning>(value.enabled));
      return { enabled, level: value.level === "custom" ? "custom" : levelOf(enabled) };
    }
  } catch { /* Unavailable storage or a value from an older editor. */ }
  return defaultHelp;
}
