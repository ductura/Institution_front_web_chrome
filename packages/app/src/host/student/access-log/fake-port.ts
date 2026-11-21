// In-memory stand-in for the access-log route (WEB-1707); invented people only.
import type { AccessLogEntry } from "../../../../../../src/components/student/access-log-days.ts";
import type { WhoOpenedPort, WhoOpenedRead } from "./model";

export const FAKE_ENTRIES: readonly AccessLogEntry[] = [
  { id: "e1", at: "2026-11-10T13:10:00.000Z", role: "mentor", surface: "live_view", reader: { givenName: "Ana", familyName: "Demo" } },
  { id: "e2", at: "2026-11-10T13:15:00.000Z", role: "mentor", surface: "live_view", reader: { givenName: "Ana", familyName: "Demo" } },
  { id: "e3", at: "2026-11-08T09:00:00.000Z", role: "teacher", surface: "submitted_text", reader: null },
];

export function fakeWhoOpenedPort(answer: WhoOpenedRead = { kind: "ok", entries: FAKE_ENTRIES, next: null }): WhoOpenedPort {
  return { read: async () => answer };
}
