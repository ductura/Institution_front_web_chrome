import type { NotificationBellLabels } from "@ductura/ui";

import type { InboxKind } from "./inbox";

/**
 * Croatian text of the bell (WEB-1702, P-1/P-2 of NF-1, PD-9). Kept beside the
 * component: the catalogue sections are other lanes'. The contract's item has
 * no title of the assignment, so a line names only what happened.
 */
export const notificationKindText: Record<InboxKind, string> = {
  assignment_version: "Nova verzija zadatka",
  deadline_reminder: "Podsjetnik na rok zadatka",
  comment_posted: "Novi komentar uz rad",
  submission_recorded: "Predaja je zabilježena",
  course_handover: "Promjena na kolegiju",
};

export const bellLabels: NotificationBellLabels = {
  button: "Obavijesti",
  buttonWithCount: (n) => `Obavijesti, nepročitanih: ${n}`,
  panel: "Popis obavijesti",
  empty: "Nema obavijesti. Ovdje će se prikazati nova verzija zadatka, podsjetnici na rok, komentari i potvrde predaje.",
  unavailable: "Obavijesti trenutačno nisu dostupne. To ne znači da ih nema.",
  unreadMark: "Novo",
  changed: (n) => (n === 0 ? "Nema nepročitanih obavijesti." : `Nepročitanih obavijesti: ${n}`),
};

/** P-2: with the assignment known, the line names it and its deadline; no pressure, no claim about behaviour. */
export const deadlineReminderLine = "Rok za zadatak {title}: {due}";
