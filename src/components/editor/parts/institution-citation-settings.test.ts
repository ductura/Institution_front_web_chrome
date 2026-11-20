import { expect, it, vi } from "vitest";

import { readInstitutionCitationSettings } from "./institution-citation-settings";

const baseUrl = "https://demo.invalid";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

it("reads institution settings through the contract and prefers explicit values", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () => json({
    level: "institution",
    course: null,
    values: [{ key: "citation.style", value: "apa", bound: null, updatedAt: "2026-11-20T10:00:00.000Z" }],
    inherited: [
      { key: "citation.style", value: "fpzg", source: "default", bound: null },
      { key: "lekta.profile", value: "demo-profile", source: "default", bound: null },
    ],
  }));
  expect(await readInstitutionCitationSettings({ baseUrl, fetchImpl })).toEqual({
    styleId: "apa", profileId: "demo-profile", formattingStyle: null,
  });
  expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(`${baseUrl}/api/v1/settings/values?level=institution`);
  expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("GET");
});

it("uses the default style without inventing a profile if the reader is unavailable", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () => json({ code: "not_found" }, 404));
  expect(await readInstitutionCitationSettings({ baseUrl, fetchImpl })).toMatchObject({
    styleId: "fpzg", profileId: null, formattingStyle: { faculty: "fpzg", style: "author-date" },
  });
});
