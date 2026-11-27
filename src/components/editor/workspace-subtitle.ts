import { formatDateTimeHr } from "../../lib/i18n/hr";
import { messagesHr as t } from "../../lib/i18n/messages.hr";

import type { EditorWorkRead } from "./EditorPage.read";

const KINDS: Readonly<Record<string, string>> = t.teacher.assignment.workTypes;

/**
 * Design alignment 27. 11. 2026. (S-07, text 2): the line under the workspace's title,
 * "{kolegij}, {vrsta}, rok {rok}", e.g. "Uvod u znanstveno pisanje, Esej, rok
 * 30. studenoga 2026. u 23:59". Parts joined by a comma, never a dot. A kind the read
 * does not give, or does not name, is left out, and so is a deadline that cannot be read:
 * the raw value is never shown. The extended deadline, when there is one, is the one shown.
 */
export function workspaceSubtitle(read: Extract<EditorWorkRead, { kind: "ready" }>): string {
  const kind = read.workType === undefined ? undefined : KINDS[read.workType];
  const iso = read.extendedDueAt ?? read.dueAt;
  const due = formatDateTimeHr(iso);
  return [read.course, kind, due === iso ? undefined : t.workspace.subtitleDue.replace("{time}", due)]
    .filter((part): part is string => part !== undefined && part !== "")
    .join(", ");
}
