import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Dialog } from "./Dialog";
import { returnTarget, trappedIndex } from "./dialog-focus";
import { ToastRegion } from "./Toast";
import { addToast, MAX_TOASTS, removeToast, toastTimeout, TOAST_TIMEOUT_MS, type ToastItem } from "./toast-queue";

describe("Dialog focus (WEB-04)", () => {
  it("Tab wraps from the last to the first, Shift+Tab from the first to the last", () => {
    expect(trappedIndex(2, 3, false)).toBe(0);
    expect(trappedIndex(0, 3, true)).toBe(2);
    expect(trappedIndex(0, 3, false)).toBe(1);
    expect(trappedIndex(1, 3, true)).toBe(0);
  });

  it("from outside the list enters at the start, or at the end going back", () => {
    expect(trappedIndex(-1, 3, false)).toBe(0);
    expect(trappedIndex(-1, 3, true)).toBe(2);
  });

  it("has nowhere to go without a focusable element", () => {
    expect(trappedIndex(-1, 0, false)).toBe(-1);
  });

  it("gives the focus back to the opener only while it is on the page", () => {
    const opener = { focus: () => undefined } as unknown as Element;
    expect(returnTarget(opener, () => true)).toBe(opener);
    expect(returnTarget(opener, () => false)).toBeNull();
    expect(returnTarget(null, () => true)).toBeNull();
  });

  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(<Dialog open={false} title="Odjava" onClose={() => undefined} />)).toBe("");
  });

  it("is named by its title and shows an error as an alert", () => {
    const html = renderToStaticMarkup(
      <Dialog open title="Odjava" onClose={() => undefined} error="Odjava nije uspjela." actions={<button type="button">Ostani</button>}>
        <p>Tekst</p>
      </Dialog>,
    );
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html).toMatch(/<p role="alert"[^>]*>Odjava nije uspjela\.<\/p>/);
    expect(html).toContain("Ostani");
  });
});

describe("Toast (WEB-04)", () => {
  const item = (id: number, tone: ToastItem["tone"] = "neutral"): ToastItem => ({ id, text: `Poruka ${id}`, tone });

  it("keeps at most MAX_TOASTS, dropping the oldest", () => {
    let list: ToastItem[] = [];
    for (let id = 1; id <= MAX_TOASTS + 2; id++) list = addToast(list, item(id));
    expect(list.map((t) => t.id)).toEqual([3, 4, 5]);
    expect(removeToast(list, 4).map((t) => t.id)).toEqual([3, 5]);
  });

  it("lets a neutral toast leave by itself and keeps an error until it is closed", () => {
    expect(toastTimeout("neutral")).toBe(TOAST_TIMEOUT_MS);
    expect(toastTimeout("error")).toBeNull();
  });

  it("has both live regions on the page before any message", () => {
    const html = renderToStaticMarkup(<ToastRegion toasts={[]} onDismiss={() => undefined} label="Obavijesti" closeLabel="Zatvori" />);
    expect(html).toContain('aria-label="Obavijesti"');
    expect(html).toMatch(/role="status" aria-live="polite"/);
    expect(html).toMatch(/role="alert" aria-live="assertive"/);
  });

  it("puts an error in the alert region and a neutral message in the status region", () => {
    const html = renderToStaticMarkup(
      <ToastRegion toasts={[item(1), item(2, "error")]} onDismiss={() => undefined} label="Obavijesti" closeLabel="Zatvori" />,
    );
    const status = /role="status"[^>]*>(.*?)<\/div><div role="alert"/.exec(html)?.[1] ?? "";
    expect(status).toContain("Poruka 1");
    expect(status).not.toContain("Poruka 2");
    expect(html.split('role="alert"')[1]).toContain("Poruka 2");
    expect(html.match(/>Zatvori</g)).toHaveLength(2);
  });
});
