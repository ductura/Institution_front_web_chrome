// Ported from Ductus 0cdb0f1 (WEB-38 2/2). Requests go through createApi, so
// the routes are full URLs under the contract's prefix on an invented origin,
// and every answer has the contract's shape for its status.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { QueuedTransaction, SyncMeta } from "../../packages/editor-core/src/sync/journal-types";
import { createEvidenceTransport } from "../../packages/editor-core/src/sync/runner/evidence-transport";
import type { FetchLike, OpenedWork } from "./evidence-ingest";
import {
  browserEvidenceSessionDeps, guardedFetch, SignedOutError, watchClosedBySubmission, type BrowserEvidenceInput,
} from "./evidence-session-deps";

vi.mock("../../packages/editor-core/src/sync/runner/evidence-transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../packages/editor-core/src/sync/runner/evidence-transport")>();
  return { ...actual, createEvidenceTransport: vi.fn(actual.createEvidenceTransport) };
});

const ORIGIN = "https://ductura.example.invalid";
const COMMIT = `${ORIGIN}/api/v1/evidence/commit`;
const OPEN = `${ORIGIN}/api/v1/evidence/open`;
/** The contract takes a UUID; an invented one. */
const ASSIGNMENT = "33333333-3333-4333-8333-333333333333";
beforeAll(() => { vi.stubGlobal("location", { origin: ORIGIN }); });
afterAll(() => { vi.unstubAllGlobals(); });

const source = { navigator: { onLine: false }, addEventListener: () => {}, removeEventListener: () => {} };

function deps() {
  return browserEvidenceSessionDeps({
    journal: {} as BrowserEvidenceInput["journal"],
    documentId: "doc-1",
    assignmentId: ASSIGNMENT,
    current: () => true,
    fetchImpl: async () => new Response(null, { status: 503 }),
    source: source as unknown as BrowserEvidenceInput["source"],
  });
}

describe("browserEvidenceSessionDeps: requests only under the tab's sign-in (F-154)", () => {
  function counted(signedIn: { value: boolean }) {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify({ status: "not_found" }), { status: 404 }));
    const built = browserEvidenceSessionDeps({
      journal: {} as BrowserEvidenceInput["journal"],
      documentId: "doc-1",
      assignmentId: ASSIGNMENT,
      current: () => signedIn.value,
      fetchImpl,
      source: source as unknown as BrowserEvidenceInput["source"],
    });
    return { built, fetchImpl };
  }

  it("asks current() before every open and sends nothing once the sign-in ended", async () => {
    const signedIn = { value: true };
    const { built, fetchImpl } = counted(signedIn);
    await built.open();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    signedIn.value = false;
    expect((await built.open()).status).toBe("unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    signedIn.value = true;
    await built.open();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("the guard rejects with SignedOutError and never calls the fetch", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    await expect(guardedFetch(fetchImpl, () => false)(COMMIT, {})).rejects.toBeInstanceOf(SignedOutError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // WEB-38: without a transport of its own the guard wraps api.ts's browserTransport.
  it("guards the browser's own transport when no transport is given", async () => {
    const original = globalThis.fetch;
    const browser = vi.fn(async () => Response.json({ status: "not_found" }, { status: 404 }));
    vi.stubGlobal("fetch", browser);
    try {
      const signedIn = { value: false };
      const built = browserEvidenceSessionDeps({
        journal: {} as BrowserEvidenceInput["journal"],
        documentId: "doc-1",
        assignmentId: ASSIGNMENT,
        current: () => signedIn.value,
        source: source as unknown as BrowserEvidenceInput["source"],
      });
      expect((await built.open()).status).toBe("unavailable");
      expect(browser).not.toHaveBeenCalled();
      signedIn.value = true;
      expect((await built.open()).status).toBe("not_found");
      expect(browser).toHaveBeenCalledTimes(1);
      expect(String((browser.mock.calls[0] as unknown[])[0])).toBe(OPEN);
    } finally {
      vi.stubGlobal("fetch", original);
    }
  });
});

describe("browserEvidenceSessionDeps: stored profile (Codex #803)", () => {
  it("reads the profile the journal stores, so segments build while open is out of reach", () => {
    const meta = { evidenceProfileId: "profil-1" } as unknown as SyncMeta;
    expect(deps().storedProfile?.(meta)).toBe("profil-1");
  });

  it("gives no profile for a record without one, or no record", () => {
    expect(deps().storedProfile?.({} as unknown as SyncMeta)).toBeNull();
    expect(deps().storedProfile?.(null)).toBeNull();
  });
});

// F-155: a commit 409 not_accepting is a submission, a version not
// acknowledged or one not open yet; only the server's "submitted" closes.
describe("watchClosedBySubmission (F-155)", () => {
  const notAccepting = async () => Response.json({ status: "not_accepting" }, { status: 409 });

  async function heard(path: string, isSubmitted: () => Promise<boolean>) {
    let asked = 0;
    let fired = 0;
    const closed = watchClosedBySubmission(notAccepting, async () => { asked += 1; return isSubmitted(); });
    closed.watch(() => { fired += 1; });
    const response = await closed.fetchImpl(path, { method: "POST" });
    return { asked, fired, status: response.status, body: await response.json() };
  }

  it("closes by submission only when the server says the work is submitted", async () => {
    expect(await heard(COMMIT, async () => true))
      .toEqual({ asked: 1, fired: 1, status: 409, body: { status: "not_accepting" } });
  });

  it("closes nothing when the server says not submitted or cannot be asked", async () => {
    expect((await heard(COMMIT, async () => false)).fired).toBe(0);
    expect((await heard(COMMIT, async () => { throw new Error("invented outage"); })).fired).toBe(0);
  });

  // Codex r4384309111: an open route that never answers must not hold the
  // commit's answer, or the drain and sign-out waiting on it would hang.
  it("lets the commit answer go on after the time limit when the open route does not answer", async () => {
    let fired = 0;
    const closed = watchClosedBySubmission(notAccepting, () => new Promise<boolean>(() => {}), 20);
    closed.watch(() => { fired += 1; });
    const response = await closed.fetchImpl(COMMIT, { method: "POST" });
    expect(response.status).toBe(409);
    expect(fired).toBe(0);
  });

  it("closes nothing for a late yes that comes after the time limit", async () => {
    let fired = 0;
    let answer: (yes: boolean) => void = () => {};
    const closed = watchClosedBySubmission(notAccepting, () => new Promise<boolean>((resolve) => { answer = resolve; }), 20);
    closed.watch(() => { fired += 1; });
    await closed.fetchImpl(COMMIT, { method: "POST" });
    answer(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fired).toBe(0);
  });

  it("asks nothing for a not_accepting of another route", async () => {
    expect(await heard(OPEN, async () => true))
      .toEqual({ asked: 0, fired: 0, status: 409, body: { status: "not_accepting" } });
  });

  // WEB-38 (#105 review): only the contract's own not_accepting closes; an
  // answer createApi would not read is not asked about, whatever open says.
  it.each([
    ["an unknown field", () => Response.json({ status: "not_accepting", invented: true }, { status: 409 })],
    ["a body that is not JSON", () => new Response("{", { status: 409, headers: { "content-type": "application/json" } })],
    ["no JSON content type", () => new Response(JSON.stringify({ status: "not_accepting" }), { status: 409 })],
    ["another 409 of the contract", () => Response.json({ status: "stale_base", currentRevision: 1, documentHash: "d".repeat(64), headSegmentHash: null, lastSequenceTo: 0 }, { status: 409 })],
  ])("closes nothing and asks nothing for %s", async (_name, answer) => {
    let asked = 0;
    let fired = 0;
    const closed = watchClosedBySubmission(async () => answer(), async () => { asked += 1; return true; });
    closed.watch(() => { fired += 1; });
    expect((await closed.fetchImpl(COMMIT, { method: "POST" })).status).toBe(409);
    expect({ asked, fired }).toEqual({ asked: 0, fired: 0 });
  });

  // WEB-38: the route is known by its path; anything that only looks like it is not.
  it("asks nothing for a path that merely contains the commit route, or an unreadable one", async () => {
    for (const path of [`${COMMIT}/x`, `${ORIGIN}/api/v1/evidence/commitment`, "http://[unreadable"]) {
      expect((await heard(path, async () => true)).asked).toBe(0);
    }
  });
});

// #913 on #914: the open that confirms a submission (F-155) is built on the
// same guarded fetch as every other evidence request (F-154), as in
// browserEvidenceSessionDeps. A sign-in that ends between the commit and that
// open sends nothing more and closes nothing.
describe("F-155 confirmation under the F-154 guard", () => {
  it("sends no confirming open once the tab's sign-in has ended, and closes nothing", async () => {
    const signedIn = { value: true };
    const paths: string[] = [];
    const raw = vi.fn<FetchLike>(async (input) => {
      paths.push(String(input));
      if (input === COMMIT) {
        signedIn.value = false;
        return Response.json({ status: "not_accepting" }, { status: 409 });
      }
      return new Response(JSON.stringify({ status: "opened" }), { status: 200 });
    });
    const guarded = guardedFetch(raw, () => signedIn.value);
    const closed = watchClosedBySubmission(guarded, async () => (await guarded(OPEN, { method: "POST" })).ok);
    let fired = 0;
    closed.watch(() => { fired += 1; });
    const response = await closed.fetchImpl(COMMIT, { method: "POST" });
    expect(response.status).toBe(409);
    expect(paths).toEqual([COMMIT]);
    expect(fired).toBe(0);
  });

  it("the browser deps' open is the guarded one", async () => {
    const raw = vi.fn<FetchLike>();
    const built = browserEvidenceSessionDeps({
      journal: {} as BrowserEvidenceInput["journal"],
      documentId: "doc-1",
      assignmentId: ASSIGNMENT,
      current: () => false,
      fetchImpl: raw,
      source: source as unknown as BrowserEvidenceInput["source"],
    });
    expect((await built.open()).status).toBe("unavailable");
    expect(raw).not.toHaveBeenCalled();
  });
});

describe("DAN-595: one Ductus-Protocol state for the life of the tab (QA c.6730803432)", () => {
  const tx = {
    kind: "EVIDENCE_SEGMENT",
    clientTransactionId: "tx-synthetic-1",
    baseRevision: 0,
    segment: new Uint8Array([1, 2, 3]),
    segmentHash: "0".repeat(64),
    document: new Uint8Array([4, 5, 6]),
    sequenceFrom: 1,
    sequenceTo: 1,
    createdAt: 0,
  } as unknown as QueuedTransaction;

  it("a work opened again without a reload stays on 1 after the tab's 426 and pays no second 426", async () => {
    const protocols: (string | undefined)[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      const protocol = (init?.headers as Record<string, string> | undefined)?.["ductus-protocol"];
      protocols.push(protocol);
      return protocol === "2"
        ? Response.json({ status: "upgrade_required" }, { status: 426 })
        : Response.json({ status: "not_found" }, { status: 404 });
    };
    const openOnce = async () => {
      const built = browserEvidenceSessionDeps({
        journal: {} as BrowserEvidenceInput["journal"],
        documentId: "doc-1",
        assignmentId: ASSIGNMENT,
        current: () => true,
        fetchImpl,
        source: source as unknown as BrowserEvidenceInput["source"],
      });
      built.createRunner({} as OpenedWork);
      const transport = vi.mocked(createEvidenceTransport).mock.results.at(-1)?.value as ReturnType<typeof createEvidenceTransport>;
      await transport("doc-1", tx);
    };

    await openOnce();
    expect(protocols).toEqual(["2", "1"]);
    protocols.length = 0;
    // The same tab opens the work again (client-side navigation): a new
    // session, a new runner, a new transport, but the tab already heard 426.
    await openOnce();
    expect(protocols).toEqual(["1"]);
    expect(vi.mocked(createEvidenceTransport)).toHaveBeenCalledTimes(2);
  });
});
