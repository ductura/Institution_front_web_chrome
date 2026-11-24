import { actionLogMessages as t } from "./messages.hr";
import type { ActionLogEntry } from "./read";

export type ActionRow = { readonly id: string; readonly at: string; readonly action: string; readonly actor: string; readonly subject: string };

/** One row per entry, newest first; the entry holds roles only, never a name of a person or a student. */
export function rowsOf(entries: readonly ActionLogEntry[]): ActionRow[] {
  return [...entries]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry, index) => ({
      id: `${entry.at}#${index}`,
      at: entry.at,
      action: t.actions[entry.action],
      actor: t.roles[entry.actorRole],
      subject: entry.subjectRole === null ? t.noSubject : t.roles[entry.subjectRole],
    }));
}
