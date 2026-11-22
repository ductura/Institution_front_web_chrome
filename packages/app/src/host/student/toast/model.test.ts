import { describe, expect, it } from "vitest";

import { STUDENT_MAX_TOASTS, STUDENT_TOAST_MS, toastLifetime, withToast, withoutToast, type StudentToast } from "./model";

const toast = (id: number, tone: StudentToast["tone"] = "neutral"): StudentToast => ({ id, text: `t${id}`, tone });

describe("student toasts (PD-7)", () => {
  it("a neutral toast goes after 3.2 s, an error stays until closed", () => {
    expect(STUDENT_TOAST_MS).toBe(3200);
    expect(toastLifetime("neutral")).toBe(3200);
    expect(toastLifetime("error")).toBeNull();
  });

  it("keeps at most three, the oldest leave first", () => {
    let list: StudentToast[] = [];
    for (let i = 1; i <= STUDENT_MAX_TOASTS + 1; i++) list = withToast(list, toast(i));
    expect(list.map((t) => t.id)).toEqual([2, 3, 4]);
  });

  it("removes one by id", () => {
    expect(withoutToast([toast(1), toast(2)], 1).map((t) => t.id)).toEqual([2]);
  });
});
