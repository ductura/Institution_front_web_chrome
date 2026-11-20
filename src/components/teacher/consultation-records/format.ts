import { formatDateHr } from "../../../lib/i18n/hr";
import { consultationMessages as t } from "./messages.hr";

export function consultationDate(heldOn: string) {
  return formatDateHr(`${heldOn}T12:00:00Z`);
}

export function revisionLabel(revision: number) {
  return t.versionNumber.replace("{revision}", String(revision));
}
