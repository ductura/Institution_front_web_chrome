import { describe, expect, it } from "vitest";

import { sendProblemReport, type ProblemReportCall } from "@/components/support/problem-report-send";

import { stoppedReportHr } from "./messages.hr";
import { stoppedReportBody } from "./stopped-report";
import { failureText } from "./StoppedReport";

const UA = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

describe("ED-07 stopped-sending report", () => {
  it("names the stopped state and a technical problem, without the work", () => {
    const body = stoppedReportBody("Veza je pala.", "/rad", UA);
    expect(body).toEqual({
      appVersion: "0.1.0",
      browser: { family: "chromium", major: 131 },
      category: "technical",
      description: "Veza je pala.",
      route: "/rad",
      syncState: "ERROR",
    });
  });

  it("an empty note says what stopped, since the report needs a description", () => {
    expect(stoppedReportBody("   ", "/rad", UA)?.description).toBe(stoppedReportHr.defaultNote);
    expect(stoppedReportBody("", "/rad", UA)?.description).toBe(stoppedReportHr.defaultNote);
  });

  it("refuses a note longer than the route takes", () => {
    expect(stoppedReportBody("a".repeat(1001), "/rad", UA)).toBeNull();
  });

  it("sends exactly the route's keys, once", async () => {
    const calls: unknown[] = [];
    const call: ProblemReportCall = async (id, input) => {
      calls.push({ id, input });
      return { ok: true, status: 201, body: { reference: "PR-00000A0007" } };
    };
    const body = stoppedReportBody("", "/rad", UA);
    if (body === null) throw new Error("no body");
    const outcome = await sendProblemReport(call, { ...body, text: "tekst rada" } as typeof body, 0);
    expect(outcome).toEqual({ kind: "sent", reference: "PR-00000A0007" });
    expect(calls).toHaveLength(1);
    const wire = (calls[0] as { input: { body: Record<string, unknown> } }).input.body;
    expect(Object.keys(wire).sort()).toEqual(["appVersion", "browser", "category", "description", "route", "syncState"]);
    expect(JSON.stringify(wire)).not.toContain("tekst rada");
  });

  it("a failure is said in the support catalogue's words", () => {
    expect(failureText("support.failure.network")).not.toBe("");
    expect(failureText("nema.takvog")).toBe(failureText("support.failure.unknown"));
  });

  it("speaks plain Croatian: no state codes in the dialog", () => {
    for (const text of Object.values(stoppedReportHr)) expect(text).not.toMatch(/syncState|ERROR|technical/);
  });
});
