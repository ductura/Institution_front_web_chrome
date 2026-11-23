// In-memory stand-in for the key-dates route (WEB-1707); invented dates only, for the tests. Deliberately unsorted.
import type { KeyDatesPort, KeyDatesRead } from "./model";

export const FAKE_KEY_DATES: KeyDatesRead = {
  kind: "ready",
  dates: [
    { id: "00000000-0000-4000-8000-000000000003", kind: "consultation", at: "2027-01-20T10:00:00.000Z", state: "confirmed" },
    { id: "00000000-0000-4000-8000-000000000001", kind: "milestone", at: "2026-11-02T08:00:00.000Z", title: "Nacrt uvoda" },
    { id: "00000000-0000-4000-8000-000000000002", kind: "deadline", at: "2026-12-14T22:59:00.000Z" },
  ],
};

export function fakeKeyDatesPort(answer: KeyDatesRead = FAKE_KEY_DATES): KeyDatesPort {
  return { read: async () => answer };
}
