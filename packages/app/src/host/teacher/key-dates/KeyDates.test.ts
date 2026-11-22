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

async function show(port: KeyDatesPort) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(KeyDates, { mentorshipId: "00000000-0000-4000-8000-0000000000aa", port, title: text.forStudent("Iva Izmišljena") })); });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("KeyDates card", () => {
  it("lists the dates in order, in Zagreb time, under the student's name", async () => {
    const host = await show(fakeKeyDatesPort());
    expect(host.querySelector("h3")?.textContent).toBe("Ključni rokovi: Iva Izmišljena");
    const items = [...host.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["Etapa „Nacrt uvoda”: 2. 11. 2026. u 09:00", "Rok predaje: 14. 12. 2026. u 23:59", "Konzultacije (potvrđene): 20. 1. 2027. u 11:00"]);
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
