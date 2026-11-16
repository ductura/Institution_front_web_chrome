import { describe, expect, it } from "vitest";
import { caretScrollDelta, trackVisibleArea, visibleArea, type ViewportWindow, type VisibleArea } from "./viewport.ts";

const phone = { innerWidth: 390, innerHeight: 844 };

describe("visibleArea", () => {
  it("is the whole height without a keyboard", () => {
    expect(visibleArea({ ...phone, visual: { height: 844, offsetTop: 0 } })).toEqual({
      width: 390,
      visibleHeight: 844,
      offsetTop: 0,
      keyboardInset: 0,
      keyboardOpen: false,
      fullHeight: 844,
    });
  });

  it("shrinks with the keyboard and puts the inset under the bar (WebKit: innerHeight stays)", () => {
    const area = visibleArea({ ...phone, visual: { height: 500, offsetTop: 0 } });
    expect(area).toMatchObject({ visibleHeight: 500, keyboardInset: 344, keyboardOpen: true });
  });

  it("takes the visual viewport offset into account when the page is scrolled under the keyboard", () => {
    expect(visibleArea({ ...phone, visual: { height: 500, offsetTop: 120 } })).toMatchObject({ offsetTop: 120, keyboardInset: 224 });
  });

  it("remembers the full height at the same width when the layout viewport itself shrinks (older Android)", () => {
    const first = visibleArea({ ...phone, visual: { height: 844, offsetTop: 0 } });
    const open = visibleArea({ innerWidth: 390, innerHeight: 450, visual: { height: 450, offsetTop: 0 } }, first);
    expect(open).toMatchObject({ fullHeight: 844, keyboardOpen: true, keyboardInset: 0 });
  });

  it("starts the measurement over when the width changes (turning the device)", () => {
    const portrait = visibleArea({ ...phone });
    const landscape = visibleArea({ innerWidth: 844, innerHeight: 390 }, portrait);
    expect(landscape).toMatchObject({ fullHeight: 390, keyboardOpen: false });
  });

  it("counts a small change (address bar) as no keyboard", () => {
    expect(visibleArea({ ...phone, visual: { height: 760, offsetTop: 0 } }).keyboardOpen).toBe(false);
  });

  it("uses innerHeight without visualViewport", () => {
    expect(visibleArea({ ...phone, visual: null })).toMatchObject({ visibleHeight: 844, offsetTop: 0, keyboardInset: 0 });
  });

  it("keeps NaN, negative, infinite and oversized values inside [0, innerHeight]", () => {
    expect(visibleArea({ ...phone, visual: { height: Number.NaN, offsetTop: Number.NaN } })).toMatchObject({ visibleHeight: 844, offsetTop: 0 });
    expect(visibleArea({ ...phone, visual: { height: -50, offsetTop: -10 } })).toMatchObject({ visibleHeight: 0, offsetTop: 0, keyboardInset: 844 });
    expect(visibleArea({ ...phone, visual: { height: 10_000, offsetTop: 9_000 } })).toMatchObject({ visibleHeight: 844, offsetTop: 0 });
    expect(visibleArea({ ...phone, visual: { height: 500, offsetTop: Infinity } })).toMatchObject({ offsetTop: 0 });
    expect(visibleArea({ innerWidth: Number.NaN, innerHeight: -1 })).toMatchObject({ width: 0, visibleHeight: 0, keyboardOpen: false, fullHeight: 0 });
  });
});

describe("caretScrollDelta", () => {
  const area = { visibleHeight: 500, offsetTop: 0 };

  it("does not scroll when the caret is visible", () => {
    expect(caretScrollDelta({ top: 200, bottom: 220 }, area)).toBe(0);
  });

  it("scrolls the caret up from under the keyboard, with the margin", () => {
    expect(caretScrollDelta({ top: 600, bottom: 620 }, area)).toBe(620 - 492);
  });

  it("scrolls down to a caret above the visible part", () => {
    expect(caretScrollDelta({ top: 50, bottom: 70 }, { visibleHeight: 500, offsetTop: 100 })).toBe(50 - 108);
  });

  it("aligns a caret taller than the visible part to its top", () => {
    expect(caretScrollDelta({ top: 300, bottom: 400 }, { visibleHeight: 60, offsetTop: 10 })).toBe(290);
    expect(caretScrollDelta({ top: 300, bottom: 320 }, { visibleHeight: 0, offsetTop: 0 })).toBe(300);
  });

  it("shrinks the margin when the visible part is barely taller than the caret", () => {
    expect(caretScrollDelta({ top: 100, bottom: 120 }, { visibleHeight: 24, offsetTop: 0 }, 8)).toBe(98);
  });

  it("accepts top and bottom in either order", () => {
    expect(caretScrollDelta({ top: 620, bottom: 600 }, area)).toBe(620 - 492);
  });

  it("gives zero for non-finite input", () => {
    expect(caretScrollDelta({ top: Number.NaN, bottom: 10 }, area)).toBe(0);
    expect(caretScrollDelta({ top: 0, bottom: 10 }, { visibleHeight: Infinity, offsetTop: 0 })).toBe(0);
  });
});

describe("trackVisibleArea", () => {
  function fakeWindow() {
    const listeners = new Map<string, Set<() => void>>();
    const target = (prefix: string) => ({
      addEventListener: (t: string, l: () => void) => {
        const key = `${prefix}:${t}`;
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(l);
      },
      removeEventListener: (t: string, l: () => void) => listeners.get(`${prefix}:${t}`)?.delete(l),
    });
    const vv = { ...target("vv"), height: 844, offsetTop: 0 };
    const win: ViewportWindow = { ...target("win"), innerWidth: 390, innerHeight: 844, visualViewport: vv };
    const fire = (key: string) => listeners.get(key)?.forEach((l) => l());
    const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);
    return { win, vv, fire, count };
  }

  it("reports now, after visualViewport and window events, and stops on dispose", () => {
    const { win, vv, fire, count } = fakeWindow();
    const seen: VisibleArea[] = [];
    const stop = trackVisibleArea(win, (a) => seen.push(a));
    expect(seen).toHaveLength(1);
    vv.height = 480;
    fire("vv:resize");
    expect(seen.at(-1)).toMatchObject({ visibleHeight: 480, keyboardOpen: true, fullHeight: 844 });
    vv.offsetTop = 40;
    fire("vv:scroll");
    expect(seen.at(-1)).toMatchObject({ offsetTop: 40 });
    // WebKit sometimes fires only window resize.
    vv.height = 844;
    vv.offsetTop = 0;
    fire("win:resize");
    expect(seen.at(-1)).toMatchObject({ keyboardOpen: false });
    expect(count()).toBe(3);
    stop();
    expect(count()).toBe(0);
  });

  it("works without visualViewport", () => {
    const seen: VisibleArea[] = [];
    const win: ViewportWindow = { innerWidth: 1024, innerHeight: 768, addEventListener() {}, removeEventListener() {} };
    trackVisibleArea(win, (a) => seen.push(a))();
    expect(seen[0]).toMatchObject({ visibleHeight: 768, keyboardOpen: false });
  });
});
