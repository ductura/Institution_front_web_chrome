import { describe, expect, it, vi } from "vitest";

import { loadRequirements, rangeDetail } from "./rehearsal-model";

const assignmentId = "a8ee8f83-2949-4a99-b358-be77cd4938dd";

describe("requirements of the opened assignment", () => {
  it.each([null, { min: 10, max: null }, { min: null, max: 10 }, { min: 10, max: 10 }])(
    "keeps the server range %j", async (wordRange) => {
      const call = vi.fn(async () => ({ ok: true as const, status: 200, body: { wordRange } }));
      await expect(loadRequirements(assignmentId, call)).resolves.toEqual({ kind: "ready", wordRange });
      expect(call).toHaveBeenCalledExactlyOnceWith("student.assignment-requirements.get", { params: { assignmentId } });
    },
  );

  it.each([{ min: 20, max: 10 }, { min: 10 }, { min: -1, max: null }, { min: 1, max: null, extra: true }])(
    "rejects the malformed range %j", async (wordRange) => {
      await expect(loadRequirements(assignmentId, async () => ({ ok: true, status: 200, body: { wordRange } })))
        .resolves.toEqual({ kind: "nepoznato" });
    },
  );

  it("distinguishes a missing response from an assignment without limits", () => {
    expect(rangeDetail(10, null)).toContain("Učitavam");
    expect(rangeDetail(10, { kind: "ready", wordRange: null })).toContain("nema zadan raspon");
    expect(rangeDetail(10, { kind: "nepoznato" })).toContain("nije dostupan");
  });

  it("uses the server's limits inclusively and works with either bound absent", () => {
    expect(rangeDetail(9, { kind: "ready", wordRange: { min: 10, max: null } })).toContain("Nedostaje 1 riječ.");
    expect(rangeDetail(11, { kind: "ready", wordRange: { min: null, max: 10 } })).toContain("Višak: 1 riječ.");
    expect(rangeDetail(10, { kind: "ready", wordRange: { min: 10, max: 10 } })).toBe("Traženi opseg: 10–10 riječi.");
  });
});
