// @vitest-environment jsdom
// N-09 keyboard shortcuts over the mounted player (F4-NAS-R17). Synthetic record: invented filler text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildReplayPlayer } from "@/client/replay-record/replay-player";
import { createBrowserReplayStepsV3 } from "@/client/replay-record/replay-steps";
import { buildRecordV3, citeAndFootnote, typeAt, V3_START_JCS } from "@/client/replay-record/replay-record-v3.fixture";

import { N09Player } from "./ReplayPage";
import { n09Messages as m } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/client/replay", async (original) => ({ ...(await original<typeof import("@/client/replay")>()), loadReplay: vi.fn(() => new Promise(() => {})) }));

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

async function mount(): Promise<HTMLElement> {
  const r = await buildRecordV3([[citeAndFootnote, typeAt(3, " Izmišljena rečenica.")]]);
  const player = await buildReplayPlayer({ startDocument: V3_START_JCS, segments: r.segments, head: r.head, resumeDocuments: {} }, createBrowserReplayStepsV3());
  if (!player.ok) throw new Error(player.reason);
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root!.render(h(N09Player, { player })));
  return host;
}
const press = (el: Element, key: string) => act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
const shown = (host: HTMLElement) => host.querySelector("[role=status] b")!.textContent;

describe("N09Player shortcuts", () => {
  it("moves by arrows, Home and End, and toggles play with Space", async () => {
    const host = await mount();
    const total = Number(/od (\d+)/.exec(shown(host)!)![1]);
    expect(total).toBeGreaterThan(1);
    const region = host.querySelector("[role=group]")!;
    press(region, "Home");
    expect(shown(host)).toBe(m.sliderValue(1, total));
    press(region, "ArrowRight");
    expect(shown(host)).toBe(m.sliderValue(2, total));
    press(region, "ArrowLeft");
    expect(shown(host)).toBe(m.sliderValue(1, total));
    press(region, "End");
    expect(shown(host)).toBe(m.sliderValue(total, total));
    press(region, " ");
    expect(host.querySelector("button[aria-pressed=true]")?.textContent).toBe(m.stop);
    press(region, " ");
    expect(host.querySelector("button")?.textContent).toBe(m.play);
  });
  it("leaves the arrows to the speed select", async () => {
    const host = await mount();
    const before = shown(host);
    const ev = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true });
    act(() => { host.querySelector("select")!.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(false);
    expect(shown(host)).toBe(before);
  });
});
