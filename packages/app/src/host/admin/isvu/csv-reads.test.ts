import { describe, expect, it } from "vitest";

import { CSV_MAX_LENGTH, previewCsvImport } from "./reads";

const COURSE = "5b1f2c3d-0000-4000-8000-000000000001";
type Seen = { method: string; path: string; body: string };
const transport = (status: number, body: unknown = {}, seen: Seen[] = []) => ({
  baseUrl: "http://localhost",
  fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(String(input), init);
    seen.push({ method: r.method, path: new URL(r.url, "http://localhost").pathname, body: await r.clone().text() });
    return Response.json(body, { status });
  },
});
const CSV = "identifier,givenName,familyName\na@aai-test.hr,Ana,Izmišljena\n";

describe("F4-OPE-R05 previewCsvImport", () => {
  it("posts the source and the text to the CSV route", async () => {
    const seen: Seen[] = [];
    await previewCsvImport(COURSE, "merlin", CSV, transport(404, { error: "not_found" }, seen));
    expect(seen[0]).toMatchObject({ method: "POST", path: `/api/v1/institution/admin/courses/${COURSE}/roster-imports` });
    expect(JSON.parse(seen[0]!.body)).toEqual({ source: "merlin", csv: CSV });
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "disabled"], [503, "unavailable"]])("status %i is %s", async (status, kind) => {
    expect((await previewCsvImport(COURSE, "isvu", CSV, transport(status, { error: "x" }))).kind).toBe(kind);
  });

  it.each([["roster_columns_missing", "columns"], ["roster_too_many_rows", "tooManyRows"], ["roster_malformed", "malformed"], ["invalid_input", "invalid"]])(
    "422 %s is a rejection of the list itself (%s), not an outage", async (code, reason) => {
      expect(await previewCsvImport(COURSE, "merlin", CSV, transport(422, { error: code }))).toEqual({ kind: "rejected", reason });
    });

  it("an empty or oversized list is refused before any request", async () => {
    const seen: Seen[] = [];
    expect(await previewCsvImport(COURSE, "merlin", "  \n", transport(200, {}, seen))).toEqual({ kind: "rejected", reason: "invalid" });
    expect(await previewCsvImport(COURSE, "merlin", "x".repeat(CSV_MAX_LENGTH + 1), transport(200, {}, seen))).toEqual({ kind: "rejected", reason: "invalid" });
    expect(seen).toHaveLength(0);
  });

  it("a wrong-shaped answer is unavailable", async () => {
    expect((await previewCsvImport(COURSE, "merlin", CSV, transport(200, { rows: "no" }))).kind).toBe("unavailable");
  });
});
