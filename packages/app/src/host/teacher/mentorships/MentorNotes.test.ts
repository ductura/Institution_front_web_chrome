// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { MentorNotes } from "./MentorNotes";
import { mentorNotesText as t } from "./messages.hr";
import { addNote, readNotes, type NotesCall } from "./notes-port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Invented mentorship and notes only.
const MENTORSHIP = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-0000000000ff";
const note = (n: number, body: string) => ({ id: `00000000-0000-4000-8000-00000000010${n}`, body, createdAt: "2026-12-01T10:00:00.000Z" });

let root: Root | null = null;
const stored = new Map<string, ReturnType<typeof note>[]>([[MENTORSHIP, [note(1, "Izmišljena bilješka o dogovoru.")]]]);
const calls: string[] = [];
function server(over: Partial<Record<"get" | "post", { ok: false; status: number; code?: string } | { ok: true; status: number; body: unknown }>> = {}): () => NotesCall {
  return () => async (op, input) => {
    calls.push(op);
    const list = stored.get(input.params.id);
    if (op === "mentorship.notes.get") return over.get ?? (list ? { ok: true, status: 200, body: { notes: list } } : { ok: false, status: 404, code: "not_found" });
    if (over.post) return over.post;
    if (!list) return { ok: false, status: 404, code: "not_found" };
    const created = note(list.length + 1, (input.body as { body: string }).body);
    list.push(created);
    return { ok: true, status: 201, body: created };
  };
}
async function show(call: () => NotesCall, id = MENTORSHIP, onSignedOut?: () => void) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(MentorNotes, { mentorshipId: id, name: "Student A", call, onSignedOut })); });
  return host;
}
const type = async (host: HTMLElement, value: string) => {
  const area = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const press = async (host: HTMLElement) => { await act(async () => { host.querySelector<HTMLButtonElement>("button")!.click(); }); };

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  calls.length = 0;
  stored.set(MENTORSHIP, [note(1, "Izmišljena bilješka o dogovoru.")]);
  document.body.innerHTML = "";
});

describe("MentorNotes (MEN-R14)", () => {
  it("shows the mentor's notes the server holds", async () => {
    const host = await show(server());
    expect(host.textContent).toContain("Izmišljena bilješka o dogovoru.");
    expect(host.textContent).toContain(t.lead);
  });

  it("adds a note through the server and reads the list again", async () => {
    const host = await show(server());
    await type(host, "Nova izmišljena bilješka.");
    await press(host);
    expect(calls).toEqual(["mentorship.notes.get", "mentorship.notes.post", "mentorship.notes.get"]);
    expect(host.textContent).toContain("Nova izmišljena bilješka.");
    expect(host.textContent).toContain(t.saved);
    expect(host.querySelector("textarea")!.value).toBe("");
  });

  it("offers a refresh that keeps the draft after an uncertain write, and reads the list again", async () => {
    const host = await show(server({ post: { ok: true, status: 200, body: {} } }));
    await type(host, "Izmišljena bilješka.");
    await press(host);
    const refresh = [...host.querySelectorAll("button")].find((b) => b.textContent === t.refresh)!;
    await act(async () => { refresh.click(); });
    expect(calls).toEqual(["mentorship.notes.get", "mentorship.notes.post", "mentorship.notes.get"]);
    expect(host.querySelector("textarea")!.value).toBe("Izmišljena bilješka.");
  });

  it("shows the date in Zagreb time and keeps line breaks of a note", async () => {
    stored.set(MENTORSHIP, [{ ...note(1, "Prvi redak\nDrugi redak"), createdAt: "2026-11-10T23:30:00.000Z" }]);
    const host = await show(server());
    expect(host.textContent).toContain("11. studenoga 2026.");
    expect(host.querySelectorAll("li br").length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a blank note without calling the server", async () => {
    const host = await show(server());
    await type(host, "   ");
    await press(host);
    expect(calls).toEqual(["mentorship.notes.get"]);
    expect(host.textContent).toContain(t.needed);
  });

  it("refuses a note over the contract's limit without calling the server", async () => {
    const host = await show(server());
    await type(host, "a".repeat(4001));
    await press(host);
    expect(calls).toEqual(["mentorship.notes.get"]);
    expect(host.textContent).toContain(t.tooLong);
  });

  it("says another mentor's mentorship is not available (404), never an empty list", async () => {
    const host = await show(server(), OTHER);
    expect(host.textContent).toContain(t.notFound);
    expect(host.textContent).not.toContain(t.empty);
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("says unavailable (503, broken shape, thrown) and offers a retry, never 'none'", async () => {
    for (const get of [{ ok: false as const, status: 503, code: "unavailable" }, { ok: true as const, status: 200, body: { notes: [{ id: "x" }] } }]) {
      const host = await show(server({ get }));
      expect(host.textContent).toContain(t.unavailable);
      expect(host.textContent).not.toContain(t.empty);
      expect(host.textContent).toContain(t.retry);
      act(() => root?.unmount());
      document.body.innerHTML = "";
    }
    expect(await readNotes((async () => { throw new Error("x"); }) as unknown as NotesCall, MENTORSHIP)).toEqual({ kind: "unavailable" });
  });

  it("keeps what was typed and says it is not known when the write answer is not the contract's", async () => {
    const host = await show(server({ post: { ok: true, status: 200, body: {} } }));
    await type(host, "Izmišljena bilješka.");
    await press(host);
    expect(host.textContent).toContain(t.unknown);
    expect(host.querySelector("textarea")!.value).toBe("Izmišljena bilješka.");
    expect(calls).toEqual(["mentorship.notes.get", "mentorship.notes.post"]);
  });

  it("maps the write answers: 401 signed out, 403 forbidden, 404, 422, anything else unknown", async () => {
    const outcome = async (answer: { ok: false; status: number; code?: string }) => (await addNote(async () => answer, MENTORSHIP, "x")).outcome;
    expect(await outcome({ ok: false, status: 401 })).toBe("signedOut");
    expect(await outcome({ ok: false, status: 403, code: "forbidden" })).toBe("forbidden");
    expect(await outcome({ ok: false, status: 403, code: "cross_site" })).toBe("unknown");
    expect(await outcome({ ok: false, status: 404 })).toBe("notFound");
    expect(await outcome({ ok: false, status: 422 })).toBe("invalid");
    expect(await outcome({ ok: false, status: 503 })).toBe("unknown");
  });

  it("asks to sign in again when the session ended", async () => {
    let ended = 0;
    await show(server({ get: { ok: false, status: 401, code: "unauthorized" } }), MENTORSHIP, () => { ended++; });
    expect(ended).toBe(1);
  });
});
