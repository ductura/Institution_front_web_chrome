// Property (web PLAN §6): for any keyboard height the caret stays visible.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { caretScrollDelta, visibleArea } from "./viewport.ts";

const anyNumber = fc.oneof(
  fc.double({ min: -1e9, max: 1e9, noNaN: true }),
  fc.constantFrom(0, -0, Number.NaN, Infinity, -Infinity, Number.MAX_VALUE),
);

describe("caret stays visible for any keyboard height", () => {
  it("ends inside the visible part, or top-aligned when it cannot fit", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4000 }),
        anyNumber,
        anyNumber,
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.integer({ min: 0, max: 64 }),
        (innerHeight, keyboard, offsetTop, caretTop, caretHeight, margin) => {
          const area = visibleArea({ innerWidth: 390, innerHeight, visual: { height: innerHeight - keyboard, offsetTop } });
          expect(area.visibleHeight).toBeGreaterThanOrEqual(0);
          expect(area.visibleHeight).toBeLessThanOrEqual(innerHeight);
          expect(area.offsetTop + area.visibleHeight).toBeLessThanOrEqual(innerHeight);
          expect(area.keyboardInset).toBeGreaterThanOrEqual(0);

          const delta = caretScrollDelta({ top: caretTop, bottom: caretTop + caretHeight }, area, margin);
          expect(Number.isFinite(delta)).toBe(true);
          const top = caretTop - delta;
          const bottom = top + caretHeight;
          const eps = 1e-6 * Math.max(1, Math.abs(caretTop));
          if (caretHeight < area.visibleHeight) {
            expect(top).toBeGreaterThanOrEqual(area.offsetTop - eps);
            expect(bottom).toBeLessThanOrEqual(area.offsetTop + area.visibleHeight + eps);
          } else {
            expect(Math.abs(top - area.offsetTop)).toBeLessThanOrEqual(eps);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("does not scroll a caret that is already visible", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 2000 }), fc.integer({ min: 0, max: 2000 }), fc.double({ min: 0, max: 1, noNaN: true }), (innerHeight, keyboard, at) => {
        const area = visibleArea({ innerWidth: 390, innerHeight, visual: { height: innerHeight - keyboard, offsetTop: 0 } });
        fc.pre(area.visibleHeight >= 60);
        const top = 20 + at * (area.visibleHeight - 60);
        expect(caretScrollDelta({ top, bottom: top + 20 }, area, 8)).toBe(0);
      }),
    );
  });
});
