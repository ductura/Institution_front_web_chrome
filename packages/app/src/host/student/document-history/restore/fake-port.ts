// In-memory stand-in for the restore port (WEB-1907): an append-only list of invented revisions.
import type { RestorePort, RevisionDocument } from "./model";

export type FakeRevision = { readonly revision: number; readonly document: RevisionDocument };

export const FAKE_REVISIONS: readonly FakeRevision[] = [
  { revision: 1, document: { text: "Izmišljeni prvi odlomak." } },
  { revision: 2, document: { text: "Izmišljeni drugi odlomak." } },
  { revision: 3, document: { text: "Izmišljeni treći odlomak." } },
];

export function fakeRestorePort(start: readonly FakeRevision[] = FAKE_REVISIONS): RestorePort & { readonly revisions: readonly FakeRevision[] } {
  const revisions: FakeRevision[] = [...start];
  return {
    revisions,
    async readRevision(_id, revision) {
      const found = revisions.find((r) => r.revision === revision);
      return found ? { kind: "ready", document: found.document } : { kind: "notFound" };
    },
    async saveAsNewRevision(_id, document, baseRevision) {
      const head = revisions.at(-1)?.revision ?? 0;
      if (baseRevision !== head) return { kind: "conflict" };
      revisions.push({ revision: head + 1, document });
      return { kind: "saved", revision: head + 1 };
    },
  };
}
