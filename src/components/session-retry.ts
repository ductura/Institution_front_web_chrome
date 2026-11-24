// The one retry of the session tests (WEB-CI-LOKALNO): a *.session.test.ts may run a failed test once more,
// no other test may. Every attempt after the first is printed, so a retry is always in the log; a test that
// fails twice still fails. test/unit/ci-local.test.js checks that only *.session.test.ts use this.
// No vitest import here: src/client/no-direct-api.test.ts allows it only in test files, so the caller passes beforeEach.

/** Options of every top-level describe of a *.session.test.ts. */
export const SESSION_RETRY = { retry: 1 } as const;

const attempts = new Map<string, number>();

type Task = { id: string; name: string; file?: { name: string } };

/** Call once at the top of a *.session.test.ts with its beforeEach: prints each repeated attempt with its test. */
export function printAttempts(beforeEach: (hook: (ctx: { task: Task }) => void) => void): void {
  beforeEach(({ task }) => {
    const n = (attempts.get(task.id) ?? 0) + 1;
    attempts.set(task.id, n);
    if (n > 1) console.warn(`[session retry] ${task.file?.name ?? ""} > ${task.name}: attempt ${n} of ${SESSION_RETRY.retry + 1}`);
  });
}
