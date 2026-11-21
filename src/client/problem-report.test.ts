import { describe, expect, it } from "vitest";

import { buildProblemReportBody } from "../components/support/index.ts";
import { sendProblemReport, type ProblemReportCall } from "./problem-report.ts";

// Invented content only.
const BODY = buildProblemReportBody({
  appVersion: "0.1.0", category: "technical", description: "Izmišljeni opis: gumb ne reagira.",
  pathname: "/zadaci", syncState: null, userAgent: "Mozilla/5.0 Chrome/140.0 Safari/537.36",
}) as NonNullable<ReturnType<typeof buildProblemReportBody>>;

describe("sendProblemReport", () => {
  it("sends exactly the six keys of the route, nothing of a work", async () => {
    let wire: unknown;
    const call: ProblemReportCall = async (_id, input) => {
      wire = input.body;
      return { ok: true, status: 201, body: { reference: "PR-0A1B2C3D4E" } };
    };
    const extra = { ...BODY, text: "Izmišljeni tekst rada", title: "Izmišljeni naslov" } as typeof BODY;
    expect(await sendProblemReport(call, extra, 0)).toEqual({ kind: "sent", reference: "PR-0A1B2C3D4E" });
    expect(Object.keys(wire as object).sort()).toEqual(["appVersion", "browser", "category", "description", "route", "syncState"]);
  });

  it("reads a refused call as a failure that keeps the description", async () => {
    const outcome = await sendProblemReport(async () => ({ ok: false, status: 0 }), BODY, 0);
    expect(outcome.kind).toBe("failed");
  });

  it("locks after a 429 until the retry time", async () => {
    const outcome = await sendProblemReport(async () => ({ ok: false, status: 429, retryAfter: "120" }), BODY, 1000);
    expect(outcome).toMatchObject({ kind: "failed", retryAt: 121000 });
  });
});
