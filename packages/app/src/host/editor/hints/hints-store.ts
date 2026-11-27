// ED-82: what the hints read from the browser: the hint kinds on in "Što Ductura podcrtava dok pišete"
// and the transitions the student accepted with "U redu je", kept per person and work.
import type { HelpSettings } from "../../../../../../src/components/editor/help/preferences.ts";
import { HINT_KINDS, type HintKind } from "./hints-model";

export const transOkKey = (scope: string, workId: string) => `ductura.editor.hints-ok:${scope}:${workId}`;

export function readTransOk(store: Pick<Storage, "getItem"> | null, key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(store?.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((x): x is string => typeof x === "string").slice(0, 500) : []);
  } catch { return new Set(); }
}

export function enabledHints(settings: HelpSettings): Set<HintKind> {
  return new Set(HINT_KINDS.filter((kind) => (settings.enabled as readonly string[]).includes(kind)));
}
