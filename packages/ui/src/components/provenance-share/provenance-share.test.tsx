// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ProvenanceShare, type ProvenanceShareLabels, type ProvenanceShareState } from "./ProvenanceShare";
import { SHARE_CATEGORIES, shareIsConsistent, splitBlock, type AiMatchRecord, type ShareRecord } from "./provenance-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: ProvenanceShareLabels = {
  title: "Način unosa teksta",
  notice: "Prikazuje samo kako je tekst unesen. Ne pokazuje tko je autor teksta.",
  categories: {
    written: "napisano u Ducturi",
    ai_transferred: "preneseno iz AI pomoćnika",
    pasted: "zalijepljeno",
    imported: "uvezeno",
    unattributed: "bez zabilježenog načina unosa",
  },
  lessThanOne: "manje od 1 %",
  empty: "U predanoj verziji nema teksta.",
  textHeading: "Tekst predane verzije",
  matchLegend: "Označeno: podudara se s odgovorom AI pomoćnika.",
  noMarks: "U tekstu nema označenih dijelova.",
  loading: "Učitavam zapis o načinu unosa.",
  pending: "Zapis se još izračunava.",
  none: "Za ovu predaju nema zapisa.",
  disabled: "Zapis nije uključen.",
  error: "Zapis trenutačno nije moguće prikazati.",
  retry: "Pokušaj ponovno",
};

const record = (points: number[], percents: number[]): ShareRecord => ({
  unit: "code_point",
  totalCodePoints: points.reduce((a, b) => a + b, 0),
  categories: SHARE_CATEGORIES.map((category, i) => ({ category, codePoints: points[i]!, percent: percents[i]! })),
  notice: "not_authorship_evidence",
});

// Contract vector 9.1: T = 365, percents 53, 18, 17, 9, 3.
const VECTOR = record([195, 64, 63, 34, 9], [53, 18, 17, 9, 3]);
const BLOCKS = [
  { id: "b1", text: "Kućno kompostiranje smanjuje količinu otpada. Kompost nastaje razgradnjom organske tvari." },
  { id: "b2", text: "Proces obično traje nekoliko mjeseci." },
];
const MATCH: AiMatchRecord = {
  normalization: "ductura-match-norm-v1",
  minMatchCodePoints: 60,
  spans: [{ blockId: "b1", from: 46, to: 89 }],
  notice: "not_authorship_evidence",
};
type Ready = Extract<ProvenanceShareState, { kind: "ready" }>;
const ready = (over: Partial<Ready> = {}): Ready => ({ kind: "ready", share: VECTOR, blocks: BLOCKS, aiMatch: MATCH, ...over });

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(state: ProvenanceShareState, l: ProvenanceShareLabels = labels): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<ProvenanceShare labels={l} state={state} onRetry={() => undefined} />));
  return host;
}
function unmount() {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
}
const values = () => [...host!.querySelectorAll("dd")].map((d) => d.textContent);

afterEach(unmount);

describe("ProvenanceShare", () => {
  it("shows the five categories in the fixed order, summing to 100", () => {
    mount(ready({ share: { ...VECTOR, categories: [...VECTOR.categories].reverse() } }));
    expect([...host!.querySelectorAll("[data-category]")].map((e) => e.getAttribute("data-category"))).toEqual([...SHARE_CATEGORIES]);
    expect(values()).toEqual(["53 %", "18 %", "17 %", "9 %", "3 %"]);
    expect(values().reduce((sum, v) => sum + Number.parseInt(v!, 10), 0)).toBe(100);
  });

  it("keeps the notice beside the percents and the marks in every ready state, with no way to close it", () => {
    for (const state of [ready(), ready({ aiMatch: undefined }), ready({ share: record([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]) })]) {
      mount(state);
      expect(host!.querySelector('[data-part="share"] [data-notice]')?.textContent).toBe(labels.notice);
      expect(host!.querySelectorAll("button").length).toBe(0);
      unmount();
    }
    mount(ready());
    const notice = host!.querySelector('[data-part="match"] [data-notice]')!;
    expect(notice.textContent).toContain(labels.notice);
    const marks = [...host!.querySelectorAll("[data-block] mark")];
    expect(marks.map((m) => m.textContent)).toEqual(["Kompost nastaje razgradnjom organske tvari."]);
    expect(marks.every((m) => m.getAttribute("aria-describedby") === notice.id)).toBe(true);
  });

  it("shows neither percents nor marks when there is no notice text", () => {
    mount(ready(), { ...labels, notice: " " });
    expect(host!.querySelectorAll("dd, mark").length).toBe(0);
    expect(host!.querySelector('[role="alert"]')?.textContent).toBe(labels.error);
  });

  it("has no control that blocks, ranks or sorts", () => {
    mount(ready());
    expect(host!.querySelectorAll("button, input, select, textarea, a, [contenteditable], [aria-sort], [role=slider]").length).toBe(0);
    expect(host!.querySelector("[style]")).toBeNull();
  });

  it("writes the less-than-one text for a category with text rounded to 0, and an empty state for no text", () => {
    mount(ready({ share: record([598, 1, 1, 0, 0], [100, 0, 0, 0, 0]), aiMatch: undefined }));
    expect(values()).toEqual(["100 %", labels.lessThanOne, labels.lessThanOne, "0 %", "0 %"]);
    unmount();
    mount(ready({ share: record([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]), aiMatch: undefined }));
    expect(values()).toEqual([]);
    expect(host!.textContent).toContain(labels.empty);
  });

  it("says so when the marker found no match, without a count", () => {
    mount(ready({ aiMatch: { ...MATCH, spans: [] } }));
    expect(host!.querySelectorAll("mark").length).toBe(1);
    expect(host!.textContent).toContain(labels.noMarks);
  });

  it("shows nothing of a record whose numbers or spans do not add up", () => {
    for (const bad of [
      ready({ share: record([1, 1, 1, 0, 0], [34, 33, 34, 0, 0]) }),
      ready({ share: { ...VECTOR, categories: VECTOR.categories.slice(1) } }),
      ready({ aiMatch: { ...MATCH, spans: [{ blockId: "b2", from: 0, to: 999 }] } }),
      ready({ aiMatch: { ...MATCH, spans: [{ blockId: "b9", from: 0, to: 2 }] } }),
    ]) {
      mount(bad);
      expect(host!.querySelectorAll("dd, mark").length).toBe(0);
      expect(host!.querySelector('[role="alert"]')?.textContent).toBe(labels.error);
      unmount();
    }
  });

  it("accepts the contract's rounding vectors and rejects a percent without text", () => {
    expect(shareIsConsistent(record([1, 1, 1, 0, 0], [34, 33, 33, 0, 0]))).toBe(true);
    expect(shareIsConsistent(record([1, 2, 0, 0, 0], [33, 67, 0, 0, 0]))).toBe(true);
    expect(shareIsConsistent(record([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]))).toBe(true);
    expect(shareIsConsistent(record([0, 0, 0, 0, 0], [100, 0, 0, 0, 0]))).toBe(false);
  });

  it("splits by code points, not UTF-16 units, and refuses overlapping spans", () => {
    expect(splitBlock({ id: "x", text: "a😀bc" }, [{ blockId: "x", from: 1, to: 3 }])).toEqual([
      { text: "a", matched: false },
      { text: "😀b", matched: true },
      { text: "c", matched: false },
    ]);
    expect(splitBlock({ id: "x", text: "abcdef" }, [{ blockId: "x", from: 0, to: 3 }, { blockId: "x", from: 2, to: 4 }])).toBeNull();
  });

  it("shows the waiting and error states, with retry only on the error", () => {
    const waiting = [["loading", labels.loading], ["pending", labels.pending], ["none", labels.none], ["disabled", labels.disabled]] as const;
    for (const [kind, text] of waiting) {
      mount({ kind });
      expect(host!.querySelector('[role="status"]')?.textContent).toBe(text);
      expect(host!.querySelectorAll("button, dd, mark").length).toBe(0);
      unmount();
    }
    mount({ kind: "error" });
    expect([...host!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([labels.retry]);
  });

  it("has no axe violations", async () => {
    mount(ready());
    expect((await axe.run(host!)).violations).toEqual([]);
  });
});
