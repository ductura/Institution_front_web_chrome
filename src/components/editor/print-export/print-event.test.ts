// ED-06 (NF2-P23): "Izvezi ▾ → Pregled ispisa" asks the page for its print preview through one cancelable event.
import { describe, expect, it } from "vitest";

import { askPrintPreview, PRINT_PREVIEW_EVENT } from "./print-event";

describe("askPrintPreview", () => {
  it("is false when no page answers", () => {
    expect(askPrintPreview(new EventTarget())).toBe(false);
  });

  it("is true when the page answers by cancelling the ask", () => {
    const page = new EventTarget();
    let asked = 0;
    page.addEventListener(PRINT_PREVIEW_EVENT, (event) => { asked += 1; event.preventDefault(); });
    expect(askPrintPreview(page)).toBe(true);
    expect(asked).toBe(1);
  });
});
