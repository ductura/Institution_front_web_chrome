// In-memory stand-in for the direct-edit route, shared by the tests of both roles
// (WEB-1703). It holds one state per work, as the server would.
import type { DirectEditPort, DirectEditRead, DirectEditWrite } from "./model";

export function fakeDirectEditPort(initial = false): DirectEditPort & { readonly writes: boolean[] } {
  let enabled = initial;
  let at: string | null = null;
  const writes: boolean[] = [];
  return {
    writes,
    async read(): Promise<DirectEditRead> {
      return { kind: "ready", state: { enabled, changedAt: at } };
    },
    async write(_id: string, next: boolean): Promise<DirectEditWrite> {
      writes.push(next);
      enabled = next;
      at = "2026-11-21T10:00:00.000Z";
      return { kind: "recorded", state: { enabled, changedAt: at } };
    },
  };
}
