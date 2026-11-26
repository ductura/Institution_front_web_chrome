import { formatDateTimeHr } from "@/lib/i18n/hr";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

/**
 * ED-22 (NF2-P26): the server's minute of the last signed save, from the open
 * answer, said while another tab of this browser holds the work:
 * "Zadnje spremanje na poslužitelju: 26. studenoga 2026. u 14:32."
 */
export function blockedLastSavedText(lastSignedAt: string): string {
  return t.editor.blockedLastSaved.replace("{when}", () => formatDateTimeHr(lastSignedAt));
}
