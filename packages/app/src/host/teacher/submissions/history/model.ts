import { formatDateTimeHr } from "../../../../../../../src/lib/i18n/hr";
import type { HistoryEvent, HistoryRead, SettingOutcome } from "./contract";
import { historyText as t } from "./messages.hr";

/** Newest first; the record minute decides, the id keeps equal minutes in a fixed order. */
export function newestFirst(events: readonly HistoryEvent[]): HistoryEvent[] {
  return [...events].sort((a, b) => (a.at === b.at ? a.eventId.localeCompare(b.eventId) : a.at < b.at ? 1 : -1));
}

export const eventText = (event: HistoryEvent): string => (event.kind === "withdrawn" ? t.withdrawn : t.submitted);
export const eventTime = (event: HistoryEvent): string => formatDateTimeHr(event.at);

export function failureMessage(read: HistoryRead): string {
  return read.kind === "greska" ? t.notFound : t.unavailable;
}

export type SettingNote = { readonly tone: "status" | "alert"; readonly text: string };

/** After a save: a success only from the server's answer; null when the session ended. */
export function settingNote(outcome: SettingOutcome): SettingNote | null {
  switch (outcome.kind) {
    case "spremljeno": return { tone: "status", text: t.settingSaved };
    case "greska": return { tone: "alert", text: outcome.code === "forbidden" ? t.settingForbidden : t.notFound };
    case "nepoznato": return { tone: "alert", text: t.settingUnknown };
    default: return null;
  }
}
