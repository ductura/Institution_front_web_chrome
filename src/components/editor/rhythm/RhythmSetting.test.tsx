// @vitest-environment jsdom
// PIL-P1-RITAM-PREKIDAC: the student sees the server's setting with its level and who set it, has
// no switch, and deletes the recorded rhythm only after a confirmation. The ports are fakes.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import type { RhythmEraseAnswer, RhythmPort, RhythmSettingAnswer } from "../../../client/input-rhythm";
import { createFakeRhythmPort } from "../../../client/input-rhythm-fake";
import { inputRhythmHr as t } from "../../../lib/i18n/messages.hr";
import { WhatIsRecorded } from "../help/what-is-recorded";
import { eraseText, RhythmSetting, setByText } from "./RhythmSetting";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEACHER = { role: "teacher", name: "Iva Izmišljena" } as const;

function port(setting: RhythmSettingAnswer, erase: () => Promise<RhythmEraseAnswer> = async () => ({ kind: "deleted", count: 3 })) {
  return {
    recording: vi.fn(async () => setting.kind === "ready" && setting.state.enabled),
    setting: vi.fn(async () => setting),
    erase: vi.fn(erase),
    send: vi.fn(async () => undefined),
  } satisfies RhythmPort;
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => { root!.render(node); });
  return el;
}

const byTestId = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
function button(el: HTMLElement, text: string): HTMLButtonElement {
  const found = [...el.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!found) throw new Error(`no button ${text}`);
  return found;
}

describe("rhythm setting for the student", () => {
  it("shows the server's state, its level and who set it, and offers no switch", async () => {
    const p = port({ kind: "ready", state: { enabled: false, level: "course", changedBy: TEACHER, changedAt: "2026-11-23T08:00:00.000Z" } });
    const el = await render(<RhythmSetting port={p} documentId="doc-1" />);
    expect(p.setting).toHaveBeenCalledWith("doc-1");
    expect(byTestId(el, "rhythm-setting-state")).toBe(t.off);
    expect(byTestId(el, "rhythm-setting-level")).toBe("Postavka predmeta. Zadnja promjena: nastavnik Iva Izmišljena, 23. 11. 2026.");
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(el.textContent).toContain(t.teacherOnly);
  });

  it("is on by default and says so, with the level of the default", async () => {
    const el = await render(<RhythmSetting port={createFakeRhythmPort()} documentId="doc-1" />);
    expect(byTestId(el, "rhythm-setting-state")).toBe(t.on);
    expect(byTestId(el, "rhythm-setting-level")).toBe(t.levels.default);
  });

  it("negative control: an unavailable setting is not shown as on or off", async () => {
    const el = await render(<RhythmSetting port={port({ kind: "unavailable" })} documentId="doc-1" />);
    expect(byTestId(el, "rhythm-setting-unknown")).toBe(t.unknown);
    expect(byTestId(el, "rhythm-setting-state")).toBeNull();
  });

  it("deletes only after the confirmation, once, and shows the server's outcome", async () => {
    let release: (a: RhythmEraseAnswer) => void = () => {};
    const p = port({ kind: "ready", state: { enabled: true, level: "default", changedBy: null, changedAt: null } }, () => new Promise((r) => { release = r; }));
    const el = await render(<RhythmSetting port={p} documentId="doc-1" />);
    await act(async () => button(el, t.erase.button).click());
    expect(p.erase).not.toHaveBeenCalled();
    expect(byTestId(el, "rhythm-erase-confirm")).toBe(t.erase.question);
    await act(async () => { button(el, t.erase.confirm).click(); button(el, t.erase.confirm).click(); });
    expect(p.erase).toHaveBeenCalledTimes(1);
    expect(p.erase).toHaveBeenCalledWith("doc-1");
    await act(async () => release({ kind: "deleted", count: 3 }));
    expect(byTestId(el, "rhythm-erase-outcome")).toBe("Zabilježeni ritam je obrisan (3).");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const p = port({ kind: "ready", state: { enabled: true, level: "default", changedBy: null, changedAt: null } });
    const el = await render(<RhythmSetting port={p} documentId="doc-1" />);
    await act(async () => button(el, t.erase.button).click());
    await act(async () => button(el, t.erase.cancel).click());
    expect(p.erase).not.toHaveBeenCalled();
    expect(byTestId(el, "rhythm-erase-outcome")).toBeNull();
  });

  it("negative control: an unconfirmed delete is never reported as done", async () => {
    const p = port({ kind: "ready", state: { enabled: true, level: "default", changedBy: null, changedAt: null } }, async () => ({ kind: "unavailable" }));
    const el = await render(<RhythmSetting port={p} documentId="doc-1" />);
    await act(async () => button(el, t.erase.button).click());
    await act(async () => button(el, t.erase.confirm).click());
    expect(byTestId(el, "rhythm-erase-outcome")).toBe(t.erase.failed);
  });

  it("words every outcome and level, clear of forbidden terms", () => {
    expect(eraseText({ kind: "deleted", count: 0 })).toBe(t.erase.none);
    expect(eraseText({ kind: "signedOut" })).toBe(t.erase.signedOut);
    expect(setByText({ enabled: true, level: "default", changedBy: null, changedAt: null })).toBeNull();
    expect(setByText({ enabled: false, level: null, changedBy: { role: "mentor", name: null }, changedAt: null })).toBe("Zadnja promjena: mentor.");
    expect(findForbiddenTerms(JSON.stringify(t), "hr")).toEqual([]);
  });
});

describe("what is recorded dialog", () => {
  it("reads the setting of the open work through the port it is given", async () => {
    const p = port({ kind: "ready", state: { enabled: true, level: "assignment", changedBy: TEACHER, changedAt: "2026-11-22T10:00:00.000Z" } });
    const el = await render(<WhatIsRecorded documentId="doc-7" port={p} />);
    expect(p.setting).toHaveBeenCalledWith("doc-7");
    expect(byTestId(el, "rhythm-setting-level")).toContain(t.levels.assignment);
  });

  it("without an open work it asks nothing and says the setting is not available", async () => {
    const p = port({ kind: "ready", state: { enabled: true, level: "default", changedBy: null, changedAt: null } });
    const el = await render(<WhatIsRecorded port={p} />);
    expect(p.setting).not.toHaveBeenCalled();
    expect(byTestId(el, "rhythm-setting-unknown")).toBe(t.unknown);
  });
});
