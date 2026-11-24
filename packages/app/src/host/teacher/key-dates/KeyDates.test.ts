// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { keyDatesPort, type KeyDatesCall } from "./contract";
import { fakeKeyDatesPort } from "./fake-port";
import KeyDates from "./KeyDates";
import { keyDatesMessages as text } from "./messages.hr";
import type { KeyDatesPort } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

// Invented "today": 1. 12. 2026. at noon, Zagreb.
const NOW = Date.parse("2026-12-01T11:00:00.000Z");

async function show(port: KeyDatesPort) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(KeyDates, { mentorshipId: "00000000-0000-4000-8000-0000000000aa", port, title: text.forStudent("Iva Izmišljena"), now: () => NOW })); });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("KeyDates card", () => {
  it("lists the dates in order, in Zagreb time, split at today with days to go or gone (MK-13)", async () => {
    const host = await show(fakeKeyDatesPort());
    expect(host.querySelector("h2")?.textContent).toBe("Vremenska crta rada: Iva Izmišljena");
    expect([...host.querySelectorAll("h3")].map((h) => h.textContent)).toEqual([text.past, text.ahead]);
    const items = (list: string) => [...host.querySelectorAll(`ol[data-list="${list}"] li`)].map((li) => li.textContent);
    expect(items("past")).toEqual(["Etapa „Nacrt uvoda”: 2. 11. 2026. u 09:00 (prije 29 dana)"]);
    expect(host.querySelector("[data-today]")?.textContent).toBe("Danas je 1. 12. 2026.");
    expect(items("ahead")).toEqual(["Rok predaje: 14. 12. 2026. u 23:59 (za 13 dana)", "Konzultacije (potvrđene): 20. 1. 2027. u 11:00 (za 50 dana)"]);
  });

  it("says when nothing is past yet", async () => {
    const host = await show(fakeKeyDatesPort({ kind: "ready", dates: [{ id: "00000000-0000-4000-8000-000000000009", kind: "deadline", at: "2026-12-01T22:00:00.000Z" }] }));
    expect(host.textContent).toContain(text.nothingPast);
    expect(host.querySelector('ol[data-list="ahead"] li')?.textContent).toBe("Rok predaje: 1. 12. 2026. u 23:00 (danas)");
  });

  it("an unreachable route says unavailable with a retry, never the empty text", async () => {
    let calls = 0;
    const call: KeyDatesCall = async () => { calls++; return { ok: false, status: 503, code: "unavailable" }; };
    const host = await show(keyDatesPort(() => call));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(text.unavailable);
    expect(host.textContent).not.toContain(text.empty);
    expect(host.querySelectorAll("li")).toHaveLength(0);
    await act(async () => { host.querySelector("button")!.click(); });
    expect(calls).toBe(2);
  });

  it("an empty answer says there are no key dates yet", async () => {
    const host = await show(fakeKeyDatesPort({ kind: "ready", dates: [] }));
    expect(host.textContent).toContain(text.empty);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("a signed-out read says so", async () => {
    const host = await show(fakeKeyDatesPort({ kind: "signedOut" }));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(text.signedOut);
  });
});
