// @vitest-environment jsdom
// WEB-V13-NASTAVNIK-PREGLED: the page in jsdom with test doubles for the reads. Invented slides only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { slidesSnapshotText, type Slide, type SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import { slidesReviewText as t } from "./messages.hr.ts";

const signIn = vi.hoisted(() => vi.fn());
const reads = vi.hoisted(() => ({ revision: vi.fn() }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("../../../../../../src/client/api.ts", () => ({ goToSignIn: signIn, createApi: () => vi.fn(), SERVER_PREFIX: "/api/v1/", browserTransport: vi.fn() }));
vi.mock("../../../../../../src/client/api", () => ({ goToSignIn: signIn, SERVER_PREFIX: "/api/v1/", browserTransport: vi.fn() }));
vi.mock("../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: vi.fn() }));
vi.mock("./read.ts", async (original) => ({ ...(await original<typeof import("./read.ts")>()), readSlidesRevision: reads.revision }));
const { SlidesOrWork } = await import("./SlidesReview.tsx");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const slide = (n: number, text: string, notes?: string): Slide => ({
  id: id(n), layout: "titleContent", blocks: [{ type: "heading", id: id(100 + n), slot: "title", text }], ...(notes === undefined ? {} : { notes }),
});
const doc = (...slides: Slide[]): SlidesDocument => ({ documentKind: "slides", schemaVersion: 1, slides });
void slidesSnapshotText;
const DOCS: Record<number, SlidesDocument> = { 1: doc(slide(1, "Uvod")), 2: doc(slide(1, "Uvod", "Reci pozdrav"), slide(2, "Zaključak")) };
const revisions = [
  { revision: 2, kind: "submission", savedMinute: "2026-11-20T11:00:00.000Z" },
  { revision: 1, kind: "checkpoint", savedMinute: "2026-11-20T10:00:00.000Z" },
] as const;

describe("SlidesOrWork", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    reads.revision.mockReset();
    reads.revision.mockImplementation(async (_d: string, n: number) => ({ kind: "ready", revision: n, document: DOCS[n]! }));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });
  const mount = async (answer: unknown) => {
    await act(async () => { root.render(h(SlidesOrWork, { documentId: "doc-1", path: "/nastavnik/rad/doc-1", fallback: h("p", null, "TEKSTNA STRANICA"), read: async () => answer as never })); });
  };
  const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;

  it("keeps the existing page for a text work and for a failed read (which shows its own state)", async () => {
    for (const kind of ["text", "notFound", "unavailable", "signedOut"]) {
      await mount({ kind });
      expect(host.textContent).toBe("TEKSTNA STRANICA");
    }
    expect(reads.revision).not.toHaveBeenCalled();
  });

  it("does not hold a text work back while the kind is still being read", async () => {
    await act(async () => { root.render(h(SlidesOrWork, { documentId: "doc-1", path: "/nastavnik/rad/doc-1", fallback: h("p", null, "TEKSTNA STRANICA"), read: (() => new Promise(() => {})) as never })); });
    expect(host.textContent).toBe("TEKSTNA STRANICA");
  });

  it("opens the slides of a slides work on the newest revision, with the speaker notes, read-only", async () => {
    await mount({ kind: "slides", revisions, more: false });
    expect(reads.revision).toHaveBeenCalledWith("doc-1", 2);
    expect(host.textContent).toContain(t.readOnly);
    expect(host.textContent).toContain("Reci pozdrav");
    expect(host.textContent).toContain(t.selectSlide.replace("{n}", "2").replace("{title}", "Zaključak"));
    expect(host.querySelector("textarea, input[type=text]")).toBeNull();
    expect(host.textContent).not.toContain("TEKSTNA STRANICA");
  });

  it("steps back through the revisions and shows the older state", async () => {
    await mount({ kind: "slides", revisions, more: true });
    expect(host.textContent).toContain(t.olderExist);
    await click(button(t.previous));
    expect(reads.revision).toHaveBeenCalledWith("doc-1", 1);
    expect(host.textContent).not.toContain("Zaključak");
    expect(button(t.previous).disabled).toBe(true);
  });

  it("compares two revisions on the level of slides", async () => {
    await mount({ kind: "slides", revisions, more: false });
    const select = [...host.querySelectorAll("select")].find((s) => s.labels?.[0]?.textContent?.includes(t.compareFrom))!;
    await act(async () => { select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain(t.compareSummary.replace("{added}", "1").replace("{removed}", "0").replace("{changed}", "1"));
  });

  it("shows an error, not an empty deck, when a revision cannot be read", async () => {
    reads.revision.mockImplementation(async () => ({ kind: "unavailable" }));
    await mount({ kind: "slides", revisions, more: false });
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.unavailable);
    expect(host.textContent).not.toContain(t.noSlides);
    reads.revision.mockImplementation(async () => ({ kind: "notFound" }));
    await click(button(t.retry));
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.notFound);
    expect(host.querySelector("[role=alert]")?.parentElement?.textContent).not.toContain(t.retry);
  });

  it("sends a signed-out teacher to sign-in", async () => {
    reads.revision.mockImplementation(async () => ({ kind: "signedOut" }));
    await mount({ kind: "slides", revisions, more: false });
    expect(signIn).toHaveBeenCalled();
  });
});
