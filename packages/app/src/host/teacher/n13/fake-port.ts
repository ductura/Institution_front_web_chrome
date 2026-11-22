// In-memory stand-in for the N-13 read and record (WEB-2162); invented people and times only.
import type { DeadlineExtension, ExtensionDraft, RecordOutcome } from "../../../../../../src/client/deadline-extensions";
import type { N13Data, N13Port, N13Read } from "./model";

export const FAKE_EXTENSIONS: readonly DeadlineExtension[] = [
  { id: "e-1", scope: "one", studentId: "s-4", previousDueAt: "2026-11-08T22:59:00.000Z", dueAt: "2026-11-12T22:59:00.000Z", reasonId: "justified", createdBy: "t-1", createdAt: "2026-11-04T08:20:00.000Z" },
  { id: "e-2", scope: "all", studentId: null, previousDueAt: "2026-11-12T22:59:00.000Z", dueAt: "2026-11-14T22:59:00.000Z", reasonId: null, createdBy: "t-2", createdAt: "2026-11-05T09:00:00.000Z" },
];

export const FAKE_DATA: N13Data = {
  context: { task: "Lokalni mediji i izborna kampanja", course: "Kolegij A", dueAt: "2026-11-08T22:59:00.000Z" },
  extensions: FAKE_EXTENSIONS,
  students: [
    { studentId: "s-1", name: "Ana Horvat" }, { studentId: "s-2", name: "Marko Babić" },
    { studentId: "s-3", name: null }, { studentId: "s-4", name: "Dora Matić" },
  ],
};

export function fakeN13Port(answer: N13Read = { kind: "ready", data: FAKE_DATA }, record?: (draft: ExtensionDraft) => RecordOutcome): N13Port {
  return {
    read: async () => answer,
    record: async (_id, draft) => record?.(draft) ?? { kind: "nepoznato" },
  };
}
