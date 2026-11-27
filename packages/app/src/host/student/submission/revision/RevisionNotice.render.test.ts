// @vitest-environment jsdom
// NF-3 PR-16 (E-7b): the request for revision on the steps, as one whole: deadline, comment, and
// "Pošalji doradu" unavailable with its reason. Nothing is shown without a request. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { RevisionCall } from "./contract";
import RevisionNotice from "./RevisionNotice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const page = (notifications: unknown[]): RevisionCall => async () => ({ ok: true, status: 200, body: { notifications, nextBefore: null } });
const REQUEST = {
  id: "00000000-0000-4000-8000-000000001711", targetId: ASSIGNMENT, documentId: "izmisljeni-rad-1",
  comment: "Izmišljeni komentar: doradite uvod.", revisionDueAt: "2026-12-15T12:00:00.000Z", createdAt: "2026-11-21T09:00:00.000Z", readAt: null,
};

let root: Root | null = null;
let host: HTMLElement | null = null;
async function render(call: RevisionCall, onDeclaration = false, send?: (documentId: string) => Promise<number | null>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(RevisionNotice, { assignmentId: ASSIGNMENT, call: () => call, onDeclaration, send })));
  await act(async () => { for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 0)); });
  return host;
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

describe("RevisionNotice (PR-16)", () => {
  it("shows the deadline beside the title, the comment, and a working „Pošalji doradu”", async () => {
    const el = await render(page([REQUEST]));
    expect(el.querySelector("h2")?.textContent).toBe("Rad je kod Vas: dorada");
    expect(el.textContent).toContain("Dorada do 15. 12. 2026. u 13:00");
    expect(el.textContent).toContain("Izmišljeni komentar: doradite uvod.");
    const send = el.querySelector("button")!;
    expect(send.textContent).toBe("Pošalji doradu");
    expect(send.getAttribute("aria-disabled")).toBeNull();
    expect(el.textContent).not.toContain("pregledajte izjavu");
  });

  it("sends the revision for the document of the request and says so only after a confirmed round", async () => {
    const sent: string[] = [];
    const el = await render(page([REQUEST]), false, async (id) => { sent.push(id); return 200; });
    await act(async () => { el.querySelector("button")!.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(sent).toEqual(["izmisljeni-rad-1"]);
    expect(el.textContent).toContain("Dorada je poslana nastavniku.");
    await act(async () => { el.querySelector("button")!.click(); });
    expect(sent).toHaveLength(1);
  });

  it.each([[401, "Prijava je istekla"], [403, "ne možete poslati"], [409, "rok istekao"], [null, "nije moglo biti potvrđeno"]])(
    "does not claim success when the send answers %s", async (status, text) => {
      const el = await render(page([REQUEST]), false, async () => status);
      await act(async () => { el.querySelector("button")!.click(); });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(el.textContent).toContain(text);
      expect(el.textContent).not.toContain("Dorada je poslana");
    });

  it("on the declaration step asks to look at the declaration again", async () => {
    const el = await render(page([REQUEST]), true);
    expect(el.textContent).toContain("Prije predaje dorade pregledajte izjavu i, ako se nešto promijenilo, ispravite je i potvrdite ponovno.");
  });

  it("says the deadline is not given when the server gives none", async () => {
    const el = await render(page([{ ...REQUEST, revisionDueAt: null }]));
    expect(el.textContent).toContain("Dorada");
    expect(el.textContent).toContain("nije naveden");
  });

  it("shows nothing without a request for this work or when the list cannot be read", async () => {
    expect((await render(page([{ ...REQUEST, targetId: "00000000-0000-4000-8000-0000000000a2" }]))).textContent).toBe("");
    act(() => root?.unmount());
    expect((await render(async () => ({ ok: false, status: 503, code: "unavailable" }))).textContent).toBe("");
  });
});
