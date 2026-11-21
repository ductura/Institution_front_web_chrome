import { describe, expect, it, vi } from "vitest";

import { loadRequirements, rangeDetail } from "./rehearsal-model";

const assignmentId = "a8ee8f83-2949-4a99-b358-be77cd4938dd";
const baseUrl = "https://ductura.example.invalid";
const answering = (wordRange: unknown) => vi.fn<typeof fetch>(async () => Response.json({ wordRange }));

describe("requirements of the opened assignment", () => {
  it.each([null, { min: 10, max: null }, { min: null, max: 10 }, { min: 10, max: 10 }])(
    "keeps the server range %j", async (wordRange) => {
      const fetchImpl = answering(wordRange);
      await expect(loadRequirements(assignmentId, { baseUrl, fetchImpl })).resolves.toEqual({ kind: "ready", wordRange });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, request] = fetchImpl.mock.calls[0]!;
      expect(String(url)).toBe(`${baseUrl}/api/v1/student/assignments/${assignmentId}/requirements`);
      expect(request).toMatchObject({ method: "GET", body: undefined });
    },
  );

  it.each([{ min: 20, max: 10 }, { min: 10 }, { min: 0, max: null }, { min: null, max: null }, { min: 1, max: null, extra: true }])(
    "rejects the malformed range %j", async (wordRange) => {
      await expect(loadRequirements(assignmentId, { baseUrl, fetchImpl: answering(wordRange) }))
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
