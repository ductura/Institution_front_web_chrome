import type { NotificationBellLabels } from "@ductura/ui";
import type { NotificationKind } from "../../../../../../src/client/notifications";

/** Croatian text of the bell (WEB-1702). Kept beside the component: the catalogue sections are other lanes'. */
export const notificationKindText: Record<NotificationKind, string> = {
  comment: "Novi komentar na radu",
  assignmentVersion: "Nova verzija zadatka",
  submission: "Zabilježena predaja",
};

export const bellLabels: NotificationBellLabels = {
  button: "Obavijesti",
  buttonWithCount: (n) => `Obavijesti, nepročitanih: ${n}`,
  panel: "Popis obavijesti",
  empty: "Nema obavijesti.",
  unavailable: "Obavijesti trenutačno nisu dostupne.",
  unreadMark: "Novo",
  changed: (n) => (n === 0 ? "Nema nepročitanih obavijesti." : `Nepročitanih obavijesti: ${n}`),
};
