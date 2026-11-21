// In-memory stand-in for the key-dates route (WEB-1707); invented dates only. Deliberately unsorted.
import type { KeyDatesPort, KeyDatesRead } from "./model";

export const FAKE_KEY_DATES: KeyDatesRead = {
  kind: "ready",
  dates: [
    { id: "d3", kind: "review", at: "2027-01-20T10:00:00.000Z" },
    { id: "d1", kind: "opens", at: "2026-11-02T08:00:00.000Z" },
    { id: "d2", kind: "deadline", at: "2026-12-14T22:59:00.000Z" },
  ],
};

export function fakeKeyDatesPort(answer: KeyDatesRead = FAKE_KEY_DATES): KeyDatesPort {
  return { read: async () => answer };
}
