import { describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";

import { teacherToastHr } from "./messages.hr";
import { dropToast, pushToast, TEACHER_TOAST_MS, teacherToastTimeout, toastWhenConfirmed } from "./outcome-toast";

describe("teacher toast (WEB-2164)", () => {
  it("stays 3200 ms for a neutral toast and until closed for an error", () => {
    expect(TEACHER_TOAST_MS).toBe(3200);
    expect(teacherToastTimeout("neutral")).toBe(3200);
    expect(teacherToastTimeout("error")).toBeNull();
  });

  it("keeps at most three and drops by id", () => {
    let list = pushToast([], 1, "a", "neutral");
    for (const id of [2, 3, 4]) list = pushToast(list, id, "b", "neutral");
    expect(list.map((i) => i.id)).toEqual([2, 3, 4]);
    expect(dropToast(list, 3).map((i) => i.id)).toEqual([2, 4]);
  });

  it("shows the text only after the server confirmed, never before", async () => {
    const show = vi.fn();
    let resolve!: (v: { ok: boolean }) => void;
    const pending = toastWhenConfirmed(() => new Promise<{ ok: boolean }>((r) => { resolve = r; }), show, "x");
    expect(show).not.toHaveBeenCalled();
    resolve({ ok: true });
    await pending;
    expect(show).toHaveBeenCalledWith("x");
  });

  it("shows nothing when the server did not confirm or the call throws", async () => {
    const show = vi.fn();
    await toastWhenConfirmed(async () => ({ ok: false }), show, "x");
    await expect(toastWhenConfirmed(async () => { throw new Error("down"); }, show, "x")).rejects.toThrow("down");
    expect(show).not.toHaveBeenCalled();
  });

  it("holds the prototype texts and no forbidden term (Ductus PRODUCT §5)", () => {
    expect(teacherToastHr.published).toBe("Zadatak je objavljen. Studenti grupa 2 i 4 dobivaju obavijest.");
    for (const value of Object.values(teacherToastHr)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
