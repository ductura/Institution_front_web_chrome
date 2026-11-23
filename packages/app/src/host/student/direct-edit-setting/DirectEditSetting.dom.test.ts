// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import DirectEditSetting from "./DirectEditSetting";
import { directEditSettingMessages as text } from "./messages.hr";
import type { DirectEditPort, DirectEditWrite } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = "2026-11-21T09:00:00.000Z";

/** A port whose setting is on and whose write answers only when the test says so. */
function heldPort() {
  let answer: (result: DirectEditWrite) => void = () => {};
  const writes: boolean[] = [];
  const port: DirectEditPort = {
    read: async () => ({ kind: "ready", state: { enabled: true, changedAt: at } }),
    write: (_id, enabled) => {
      writes.push(enabled);
      return new Promise<DirectEditWrite>((resolve) => { answer = resolve; });
    },
  };
  return { port, writes, answer: (result: DirectEditWrite) => answer(result) };
}

describe("DirectEditSetting sklop", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (port: DirectEditPort, submitted = false) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(DirectEditSetting, { documentId: "doc-demo-1", port, submitted })); });
    return host;
  };
  const badge = (host: HTMLElement) => host.querySelector("[data-direct-edit-badge]")?.getAttribute("data-direct-edit-badge");
  const revoke = async (host: HTMLElement) => {
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent === text.revoke) as HTMLButtonElement;
    await act(async () => { button.click(); });
  };

  it("odgovor „unknown” ostavlja oznaku nepromijenjenom", async () => {
    const held = heldPort();
    const host = await mount(held.port);
    expect(badge(host)).toBe("on");
    await revoke(host);
    expect(held.writes).toEqual([false]);
    // In flight: the mark still says allowed, the switch waits.
    expect(badge(host)).toBe("on");
    expect(host.textContent).toContain(text.saving);
    expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { held.answer({ kind: "unknown" }); });
    expect(badge(host)).toBe("on");
    expect(host.textContent).toContain(text.unknown);
  });

  it("odgovor sa starim načinom nije potvrda opoziva", async () => {
    const held = heldPort();
    const host = await mount(held.port);
    await revoke(host);
    await act(async () => { held.answer({ kind: "recorded", state: { enabled: true, changedAt: at } }); });
    expect(badge(host)).toBe("on");
    expect(host.textContent).toContain(text.unknown);
  });

  it("opoziv je „isključeno” tek kad poslužitelj potvrdi", async () => {
    const held = heldPort();
    const host = await mount(held.port);
    await revoke(host);
    expect(badge(host)).toBe("on");
    await act(async () => { held.answer({ kind: "recorded", state: { enabled: false, changedAt: at } }); });
    expect(badge(host)).toBe("off");
    expect(host.textContent).toContain(text.revokedDone);
  });

  it("predani rad nema prekidač i ne šalje ništa", async () => {
    const held = heldPort();
    const host = await mount(held.port, true);
    expect(badge(host)).toBe("on");
    expect(host.querySelectorAll("button")).toHaveLength(0);
    expect(held.writes).toEqual([]);
  });

  it("odjeljak je imenovan svojim naslovom", async () => {
    const host = await mount(heldPort().port);
    const section = host.querySelector("section") as HTMLElement;
    const heading = host.querySelector("h2") as HTMLElement;
    expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(section.hasAttribute("aria-label")).toBe(false);
  });
});
