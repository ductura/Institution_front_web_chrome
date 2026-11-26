// In-memory stand-in for the code-test routes (WEB-V21-KOD-TESTOVI-OBRAZAC), for tests and the local catalogue.
// It holds one revision list per assignment, as the server would (append-only), and answers 404 for any
// assignment it does not hold, so another course's task reads like an unknown one.
import type { CodeTestsBody, CodeTestsView } from "./model";
import type { CodeTestsPort } from "./port";

export const FAKE_ASSIGNMENT = "11111111-1111-4111-8111-111111111111";

export function fakeCodeTestsPort(held: Readonly<Record<string, CodeTestsView>> = { [FAKE_ASSIGNMENT]: { revisionNo: 0, language: "javascript", tests: [] } }): CodeTestsPort & {
  readonly revisions: (assignmentId: string) => readonly CodeTestsView[];
} {
  const revisions = new Map<string, CodeTestsView[]>(Object.entries(held).map(([id, view]) => [id, [view]]));
  const latest = (id: string) => revisions.get(id)?.at(-1);
  return {
    revisions: (id) => revisions.get(id) ?? [],
    async read(id) {
      const view = latest(id);
      return view === undefined ? { kind: "notFound" } : { kind: "ok", view };
    },
    async write(id, body: CodeTestsBody) {
      const view = latest(id);
      if (view === undefined) return { kind: "notFound" };
      const next: CodeTestsView = { revisionNo: view.revisionNo + 1, language: body.language, tests: body.tests };
      revisions.set(id, [...revisions.get(id)!, next]);
      return { kind: "done", view: next };
    },
  };
}
