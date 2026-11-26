// @vitest-environment jsdom
// ED-16 (NF2-P14): "Povijest i usporedba": names of the versions, the dialog's states and the one request.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requestWorkHistory, WORK_HISTORY_EVENT, workHistoryOffered } from "../../../../../../src/components/editor/commands/work-history-event.ts";
import type { ComparisonApi } from "../../../../../../src/components/editor/diff/comparison-read.ts";
import { fakeTimeMachinePort } from "../../student/time-machine/fake-port";
import type { TimeMachinePort, Version } from "../../student/time-machine/model";
import { workHistoryHr as t } from "./messages.hr";
import { historyRows } from "./work-history";
import { WorkHistoryHost } from "./WorkHistoryHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; the shared Dialog only needs the calls to exist.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.open = false; };

let host: HTMLDivElement | null = null;
const roots: Root[] = [];
afterEach(() => {
  act(() => { roots.splice(0).forEach((root) => root.unmount()); });
  document.body.replaceChildren();
  host = null;
});

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => { root.render(node); });
  return host;
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const ask = async () => { await act(async () => { requestWorkHistory(); }); await settle(); };
const noComparison = (async () => ({ ok: true, body: { versions: [], nextBeforeRevision: null } })) as unknown as ComparisonApi;
const version = (kind: Version["kind"], revision: number): Version => ({ kind, revision, savedMinute: "2026-11-20T09:15:00.000Z" });

describe("historyRows", () => {
  it("names submissions by their place and other versions by revision, newest first", () => {
    const rows = historyRows([version("submission", 2), version("checkpoint", 5), version("submission", 7), version("checkpoint", 1)]);
    expect(rows.map((r) => r.name)).toEqual(["Predaja 2", "Verzija 5", "Predaja 1", "Verzija 1"]);
    expect(rows[0]!.day).toBe(t.day("2026-11-20T09:15:00.000Z"));
  });

  it("names a submission by revision when older versions are not listed", () => {
    expect(historyRows([version("submission", 9)], true).map((r) => r.name)).toEqual(["Verzija 9"]);
  });
});

describe("requestWorkHistory", () => {
  it("says whether a host took the request", () => {
    expect(requestWorkHistory()).toBe(false);
    const take = (e: Event) => e.preventDefault();
    document.addEventListener(WORK_HISTORY_EVENT, take);
    expect(requestWorkHistory()).toBe(true);
    document.removeEventListener(WORK_HISTORY_EVENT, take);
  });
});

describe("WorkHistoryHost", () => {
  it("opens on the request and lists the versions with the comparison of sent ones", async () => {
    const port = fakeTimeMachinePort();
    const el = await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port, client: noComparison }));
    expect(el.querySelector("dialog")).toBeNull();
    await ask();
    expect(el.querySelector("dialog h2")?.textContent).toBe(t.title);
    expect(el.textContent).toContain(t.listTitle(3));
    expect([...el.querySelectorAll("[data-work-history] li button")].map((b) => b.textContent))
      .toEqual([`Verzija 3${t.day("2026-11-20T09:15:00.000Z")}`, `Predaja 1${t.day("2026-11-19T10:00:00.000Z")}`, `Verzija 1${t.day("2026-11-18T08:30:00.000Z")}`]);
    expect(el.textContent).toContain(t.compareTitle);
    // Without two sent versions there is nothing to choose: the reason is shown instead of the menu.
    expect(el.textContent).toContain("Za usporedbu su potrebne dvije poslane verzije.");
    expect(el.querySelector("[data-work-history] select")).toBeNull();
  });

  it("shows one version only for reading and goes back to the list", async () => {
    const el = await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port: fakeTimeMachinePort(), client: noComparison }));
    await ask();
    await act(async () => { el.querySelector<HTMLButtonElement>("[data-work-history] li button")!.click(); });
    await settle();
    expect(el.querySelector("dialog h2")?.textContent).toBe(t.readOnly("Verzija 3"));
    expect(el.querySelector("[data-version-text='3']")?.textContent).toContain("Izmišljeni odlomak verzije 3.");
    const back = [...el.querySelectorAll("button")].find((b) => b.textContent === t.back)!;
    await act(async () => { back.click(); });
    expect(el.querySelector("dialog h2")?.textContent).toBe(t.title);
  });

  it("says when there are no versions yet", async () => {
    const el = await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port: fakeTimeMachinePort([]), client: noComparison }));
    await ask();
    expect(el.querySelector("[role=status]")?.textContent).toBe(t.empty);
  });

  it("keeps the local text safe when the list fails, and asks again on retry", async () => {
    const versions = vi.fn<TimeMachinePort["versions"]>().mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValue({ kind: "ready", versions: [] });
    const port = { ...fakeTimeMachinePort(), versions };
    const el = await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port, client: noComparison }));
    await ask();
    expect(el.querySelector("[role=alert]")?.textContent).toBe(t.failed);
    const retry = [...el.querySelectorAll("button")].find((b) => b.textContent === t.retry)!;
    await act(async () => { retry.click(); });
    await settle();
    expect(versions).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain(t.empty);
  });

  it("does not take a request while the page has no document, and does not open later by itself", async () => {
    const el = await mount(createElement(WorkHistoryHost, { documentId: "", replayHref: "/r", port: fakeTimeMachinePort(), client: noComparison }));
    expect(workHistoryOffered()).toBe(false);
    let taken = true;
    await act(async () => { taken = requestWorkHistory(); });
    expect(taken).toBe(false);
    await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port: fakeTimeMachinePort(), client: noComparison }));
    expect(workHistoryOffered()).toBe(true);
    expect(el.querySelector("dialog")).toBeNull();
  });

  it("offers one menu \"Usporedi s …\" of the sent versions and compares it with the newest sent one", async () => {
    const sent = (revision: number) => ({ kind: "submission", revision, savedMinute: "2026-11-20T09:15:00.000Z" });
    const calls: string[] = [];
    const client = (async (id: string, input: { query?: { from: string; to: string } }) => {
      if (id === "work.versions.get") return { ok: true, body: { versions: [sent(7), sent(5), sent(3)], nextBeforeRevision: null } };
      calls.push(`${input.query!.from}>${input.query!.to}`);
      return { ok: true, body: { from: Number(input.query!.from), to: Number(input.query!.to), blocks: [] } };
    }) as unknown as ComparisonApi;
    const el = await mount(createElement(WorkHistoryHost, { documentId: "dok-1", replayHref: "/r", port: fakeTimeMachinePort(), client }));
    await ask();
    await settle();
    const selects = [...el.querySelectorAll("[data-work-history] select")];
    expect(selects).toHaveLength(1);
    expect(el.querySelector("label")?.textContent).toBe("Usporedi s …");
    // The newest sent version is the fixed side, so it is not offered as a choice.
    expect([...selects[0]!.querySelectorAll("option")].map((o) => o.value)).toEqual(["5", "3"]);
    expect(calls).toEqual(["5>7"]);
    await act(async () => {
      const select = selects[0] as HTMLSelectElement;
      select.value = "3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    expect(calls).toEqual(["5>7", "3>7"]);
  });
});
