// @vitest-environment jsdom
// WEB-V13-UREDNIK: the branch of WorkPage by kind of work is really mounted: a slides work in
// progress shows the slides editor, an unreadable kind its error with a retry, a text work the
// text editor as before.
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const kinds: { documentKind?: unknown } = {};
const calls: string[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: () => {},
  createApi: () => async (op: string) => {
    calls.push(op);
    if (op === "student.assignments.get") {
      return { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Prezentacija", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false, ...kinds }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
vi.mock("../../../../../src/components/editor/EditorPageWork.tsx", () => ({ default: ({ topBar }: { topBar?: unknown }) => createElement("div", null, topBar as never, createElement("p", null, "TEKSTNI-UREDNIK")) }));
// WEB-V13-DNEVNIK-SINKRONIZACIJA: the slides page now opens a journal session (Web Locks, IndexedDB, the open
// route), which jsdom has none of; the session is stood in for here (it has its own tests in slides/sync) so
// that this test keeps checking what it always checked: which editor the kind of work mounts.
const session: { phase: string; receiptVerified: boolean } = { phase: "ready", receiptVerified: false };
vi.mock("../slides/sync/use-slides-session.ts", async () => {
  const { slidesRevisionZeroDocument } = await import("../../../../editor-core/src/slides/index.ts");
  return {
    useSlidesSession: () => session.phase === "ready"
      ? { phase: "ready", documentId: "dokument-izmisljeni-1", document: slidesRevisionZeroDocument(), readOnly: false, onSteps: () => {},
          snapshot: {
            state: session.receiptVerified ? "SYNCED" : "LOCAL_DURABLE", failure: null, receiptVerified: session.receiptVerified,
            closedBy: null, stopped: false, refused: false,
          } }
      : { phase: session.phase },
  };
});
vi.mock("./work/requirements", () => ({ readWordRange: async () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = host = null;
  for (const key of Object.keys(kinds)) delete (kinds as Record<string, unknown>)[key];
});

async function open() {
  const { WorkPage } = await import("./work.tsx");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(WorkPage, { assignmentId: ID })));
  // The page reads asynchronously: wait until it shows an editor, an error or the text editor.
  for (let n = 0; n < 100 && !/Uređivač slajdova|ne mogu otvoriti|TEKSTNI-UREDNIK/.test(host.innerHTML); n += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  }
  return host;
}

describe("WorkPage by kind of work", { timeout: 30000 }, () => {
  it("documentKind slides mounts the slides editor", async () => {
    kinds.documentKind = "slides";
    const el = await open();
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).not.toBeNull();
    expect(el.textContent).not.toContain("TEKSTNI-UREDNIK");
  });
  it("a slides work whose session cannot open says so and shows no editor, not an empty one", async () => {
    kinds.documentKind = "slides";
    session.phase = "unavailable";
    try {
      const el = await open();
      expect(el.textContent).toContain("Spremanje na ovom uređaju nije moguće");
      expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
    } finally {
      session.phase = "ready";
    }
  });
  it("a slides work opened in another tab says so and saves nothing", async () => {
    kinds.documentKind = "slides";
    session.phase = "blocked";
    try {
      const el = await open();
      expect(el.textContent).toContain("Rad je otvoren u drugoj kartici");
      expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
    } finally {
      session.phase = "ready";
    }
  });
  it("a kind the client does not know shows the error with a retry, never an editor", async () => {
    kinds.documentKind = "video";
    const el = await open();
    expect(el.textContent).toContain("Slajdovi se ne mogu otvoriti");
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
    expect([...el.querySelectorAll("button")].some((b) => b.textContent === "Pokušaj ponovno")).toBe(true);
  });
  it("text, and an answer without the field, keep the text editor", async () => {
    kinds.documentKind = "text";
    expect((await open()).textContent).toContain("TEKSTNI-UREDNIK");
    act(() => root?.unmount());
    host?.remove();
    delete kinds.documentKind;
    const el = await open();
    expect(el.textContent).toContain("TEKSTNI-UREDNIK");
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
  });
  it("the text editor's shell links \"Kako vidi nastavnik\" to the student's own read-only view (F4-EDI-R14)", async () => {
    const link = (await open()).querySelector("a[href$='/rad/" + ID + "/nastavnik']");
    expect(link).not.toBeNull();
  });
  it("F4-V13-R03: the slides editor offers .pptx and PDF, off with the reason until the server confirmed", async () => {
    kinds.documentKind = "slides";
    const el = await open();
    const region = el.querySelector("section[aria-label='Izvoz slajdova']");
    expect(region).not.toBeNull();
    const buttons = [...region!.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Preuzmi .pptx", "Preuzmi PDF"]);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(region!.querySelector("[role='note']")?.textContent).toBe("Izvoz je moguć tek kad poslužitelj potvrdi zadnju reviziju slajdova.");
    expect(calls).not.toContain("work.export-slides.get");
  });
  it("F4-V13-R03: with a verified receipt the export buttons are on and the note is gone", async () => {
    kinds.documentKind = "slides";
    session.receiptVerified = true;
    try {
      const region = (await open()).querySelector("section[aria-label='Izvoz slajdova']");
      expect([...region!.querySelectorAll("button")].every((b) => !b.disabled)).toBe(true);
      expect(region!.querySelector("[role='note']")).toBeNull();
    } finally {
      session.receiptVerified = false;
    }
  });
  it("F4-V13-R03: a slides work whose session cannot open offers no export", async () => {
    kinds.documentKind = "slides";
    session.phase = "unavailable";
    try {
      expect((await open()).querySelector("section[aria-label='Izvoz slajdova']")).toBeNull();
    } finally {
      session.phase = "ready";
    }
  });
  it("the slides page has the plain top bar: no text-editor shell switches", async () => {
    kinds.documentKind = "slides";
    const el = await open();
    expect(el.textContent).not.toContain("Samo naslovi");
  });
});
