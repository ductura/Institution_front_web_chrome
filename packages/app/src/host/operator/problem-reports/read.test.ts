import { describe, expect, it } from "vitest";

import { readReports, setReportStatus, type ReportsData } from "./read";
import { reportRows } from "./view";

const baseUrl = "https://ductura.example.invalid";
const report = (n: number, over: Partial<ReportsData["reports"][number]> = {}): ReportsData["reports"][number] => ({
  reference: `PR-00000000A${n}`, category: "technical", routedTo: "network_engineer", courseId: null, description: `Izmišljen opis ${n}`,
  route: "/student", appVersion: "1.2.3", browser: { family: "chromium", major: 130 }, syncState: null,
  createdAt: `2026-11-2${n}T09:00:00.000Z`, status: "received", statusChangedAt: null, statusChangedByRole: null, statusChangedByMe: false, ...over,
});
const demo: ReportsData = { truncated: false, reports: [report(1), report(2, { category: "account", routedTo: "institution_admin" })] };

describe("prijave problema (NF-7 OA-7)", () => {
  it("čita popis kroz ugovor, redovi idu od najnovije", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => { calls.push(`${init?.method} ${new URL(String(url)).pathname}`); return Response.json(demo); };
    const got = await readReports({ baseUrl, fetchImpl });
    expect(got).toEqual({ kind: "ready", data: demo });
    expect(calls).toEqual(["GET /api/v1/problem-reports"]);
    expect(reportRows(demo.reports).map((r) => [r.reference, r.category, r.handler])).toEqual([
      ["PR-00000000A2", "Račun i uloge", "administrator fakulteta"],
      ["PR-00000000A1", "Tehnički problem", "operater"],
    ]);
  });

  it("prazan popis je ready s nula prijava; 401 i 403 su 'nema ovlasti'; ostalo 'nedostupno'", async () => {
    await expect(readReports({ baseUrl, fetchImpl: async () => Response.json({ reports: [], truncated: false }) })).resolves.toEqual({ kind: "ready", data: { reports: [], truncated: false } });
    for (const status of [401, 403]) await expect(readReports({ baseUrl, fetchImpl: async () => Response.json({}, { status }) })).resolves.toEqual({ kind: "denied" });
    await expect(readReports({ baseUrl, fetchImpl: async () => Response.json({}, { status: 503 }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readReports({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });

  it("promjena stanja šalje samo novo stanje na oznaku prijave", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      seen.push({ url: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
      return Response.json({ reference: "PR-00000000A1", status: "resolved", statusChangedAt: "2026-11-24T08:00:00.000Z" });
    };
    await expect(setReportStatus("PR-00000000A1", "resolved", { baseUrl, fetchImpl })).resolves.toEqual({ kind: "changed", status: "resolved", at: "2026-11-24T08:00:00.000Z" });
    expect(seen).toEqual([{ url: "/api/v1/problem-reports/PR-00000000A1/status", body: { status: "resolved" } }]);
  });

  it("promjena: 403 je 'nema ovlasti', 404 je 'nema prijave', ostalo 'nedostupno'", async () => {
    const answer = (status: number) => ({ baseUrl, fetchImpl: async () => Response.json({}, { status }) });
    await expect(setReportStatus("PR-00000000A1", "resolved", answer(403))).resolves.toEqual({ kind: "denied" });
    await expect(setReportStatus("PR-00000000A1", "resolved", answer(404))).resolves.toEqual({ kind: "gone" });
    await expect(setReportStatus("PR-00000000A1", "resolved", answer(503))).resolves.toEqual({ kind: "unavailable" });
    await expect(setReportStatus("PR-00000000A1", "resolved", { baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });
});
