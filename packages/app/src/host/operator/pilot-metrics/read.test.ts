import { describe, expect, it, vi } from "vitest";

import { readPilotMetrics, type PilotMetricsData } from "./read";

const baseUrl = "https://ductura.example.invalid";
const demo: PilotMetricsData = {
  asOf: "2026-11-20T23:00:00.000Z",
  minimumGroup: 5,
  submissions: { recorded: 10, notRecorded: 0 },
  receipts: { issued: null, pending: null },
  helpRequests: { total: 10, saveProblems: 5 },
  receiptTime: { p50Ms: null, p95Ms: null },
};

describe("operaterska mjerila pilota", () => {
  it("čita samo zbirni odgovor poslužitelja i zadržava nulu i skrivene vrijednosti", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(demo));
    await expect(readPilotMetrics({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "ready", data: demo });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      new URL("/api/v1/ops/pilot-metrics", baseUrl), expect.objectContaining({ method: "GET", body: undefined }),
    );
  });

  it.each([401, 403])("ne izlaže mjerila uz odgovor %s", async (status) => {
    const fetchImpl = async () => Response.json(demo, { status });
    await expect(readPilotMetrics({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "denied" });
  });

  it.each([
    { ...demo, helpRequests: { ...demo.helpRequests, person: "demo-operator" } },
    { ...demo, submissions: { ...demo.submissions, notRecorded: 4 } },
  ])("odbija odgovor izvan zbirnog ugovora", async (body) => {
    const fetchImpl = async () => Response.json(body);
    await expect(readPilotMetrics({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "unavailable" });
  });

  it("ne prikazuje zamjenske brojeve nakon neuspjelog čitanja", async () => {
    const fetchImpl = async () => { throw new Error("offline"); };
    await expect(readPilotMetrics({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "unavailable" });
  });
});
