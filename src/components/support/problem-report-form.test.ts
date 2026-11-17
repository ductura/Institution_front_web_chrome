import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { messagesHr } from "../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { checkMessage, canSend, stepAfter, submitProblemReport, textOf, type FormStep } from "./problem-report-form";
import { outcomeFromResponse, type ProblemReportBody, type ProblemReportInput } from "./problem-report";

// DAN-873-2: the form's steps follow the route's vectors. send is a fake server
// over the verbatim vector copy (blob 6bfb2d32), the clock is a number.
type Vector = { name: string; kind: string; request: { body?: ProblemReportBody }; response: { status: number; body: unknown } };
const vectors = (JSON.parse(readFileSync(new URL("./fixtures/support.problem-report.post.json", import.meta.url), "utf8")) as { vectors: Vector[] }).vectors;
const vector = (name: string) => vectors.find((v) => v.name === name) as Vector;
const NOW = 1_800_000_000_000;

/** A fake server that answers every send with the vector, retry-after as given. */
function fake(v: Vector, retryAfter: string | null = null) {
  return vi.fn(async (_body: ProblemReportBody) => outcomeFromResponse(v.response.status, v.response.body, retryAfter, NOW));
}

const INPUT: ProblemReportInput = {
  appVersion: "1.4.0",
  category: "technical",
  description: "Izmišljeni opis: gumb za spremanje ne reagira.",
  pathname: "/zadaci",
  syncState: "SYNCED",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
};
const EDITING: FormStep = { kind: "editing" };

describe("nothing is sent outside the description and category classes", () => {
  const rows: [string, string, string][] = [
    ["empty", "", "empty"],
    ["spaces", "   ", "empty"],
    ["CRLF and tab", "\r\n\t", "empty"],
    ["NBSP", "  ", "empty"],
    ["zero width space", "​", "empty"],
    ["1001 letters", "a".repeat(1001), "tooLong"],
    ["1001 emoji", "\u{1F600}".repeat(1001), "tooLong"],
    ["DEL", "a\u007Fb", "invalid"],
    ["bidi override", "a‮b", "invalid"],
    ["lone surrogate", "a\uD83D", "invalid"],
  ];
  it.each(rows)("%s", async (_name, description, check) => {
    const send = fake(vector("recorded"));
    await expect(submitProblemReport({ ...INPUT, description }, EDITING, NOW, send)).resolves.toEqual({ check });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["toString", "__proto__", "constructor"])("category %s", async (category) => {
    const send = fake(vector("recorded"));
    const input = { ...INPUT, category } as unknown as ProblemReportInput;
    await expect(submitProblemReport(input, EDITING, NOW, send)).resolves.toEqual({ refused: "category" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing while a send is in flight", async () => {
    const send = fake(vector("recorded"));
    await expect(submitProblemReport(INPUT, { kind: "sending" }, NOW, send)).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(canSend({ kind: "sending" }, NOW)).toBe(false);
  });
});

describe("success vectors give the confirmation", () => {
  it.each(vectors.filter((v) => v.kind === "success").map((v) => v.name))("%s", async (name) => {
    const v = vector(name);
    const body = v.request.body as ProblemReportBody;
    const send = fake(v);
    const input: ProblemReportInput = {
      appVersion: body.appVersion,
      category: body.category,
      description: body.description,
      pathname: body.route ?? "/nepoznato/123",
      syncState: body.syncState,
      userAgent: body.browser.family === "firefox" ? INPUT.userAgent : "curl/8.0",
    };
    const step = await submitProblemReport(input, EDITING, NOW, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(body);
    expect(step).toEqual({ step: { kind: "sent", reference: (v.response.body as { reference: string }).reference } });
  });
});

describe("429 locks sending until the time from retry-after", () => {
  it("with retry-after: 120, by the fake clock", async () => {
    const result = await submitProblemReport(INPUT, EDITING, NOW, fake(vector("too-many-reports"), "120"));
    const step = (result as { step: FormStep }).step;
    expect(step).toEqual({ kind: "failed", lead: "support.failedLead", messageKey: "support.failure.tooMany", retryAt: NOW + 120_000 });
    expect(canSend(step, NOW + 119_999)).toBe(false);
    expect(canSend(step, NOW + 120_000)).toBe(true);
    const again = fake(vector("recorded"));
    await expect(submitProblemReport(INPUT, step, NOW + 119_999, again)).resolves.toBeNull();
    expect(again).not.toHaveBeenCalled();
    await submitProblemReport(INPUT, step, NOW + 120_000, again);
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("without retry-after (the vector as it is) sending is open at once", async () => {
    const result = await submitProblemReport(INPUT, EDITING, NOW, fake(vector("too-many-reports")));
    const step = (result as { step: FormStep }).step;
    expect(step).toMatchObject({ kind: "failed", retryAt: null });
    expect(canSend(step, NOW)).toBe(true);
  });
});

describe("texts", () => {
  const errors = vectors.filter((v) => v.kind === "error");
  const maybeRecorded = new Set(["support.failure.unavailable", "support.failure.unknown", "support.failure.network", "support.failure.timeout"]);

  it.each(errors.map((v) => v.name))("%s gives a catalogue text and the right lead", async (name) => {
    const result = await submitProblemReport(INPUT, EDITING, NOW, fake(vector(name)));
    const step = (result as { step: FormStep }).step;
    if (step.kind !== "failed") throw new Error("expected failed");
    expect(textOf(step.messageKey)).toEqual(expect.any(String));
    expect(step.lead).toBe(maybeRecorded.has(step.messageKey) ? "support.keptLead" : "support.failedLead");
  });

  it("503 and an unknown answer say the report may have arrived", () => {
    expect(stepAfter({ kind: "failed", messageKey: "support.failure.unavailable", retryAt: null })).toMatchObject({ lead: "support.keptLead" });
    expect(stepAfter({ kind: "failed", messageKey: "support.failure.unknown", retryAt: null })).toMatchObject({ lead: "support.keptLead" });
    expect(textOf("support.keptLead")).not.toMatch(/nije poslana/);
    expect(textOf("support.failedLead")).toMatch(/nije poslana/);
  });

  it("a key that is no own text of the catalogue gives null", () => {
    for (const key of ["support", "support.toString", "__proto__.x", "support.failure.__proto__", ""]) expect(textOf(key)).toBeNull();
  });

  it("check messages give the length and the limit", () => {
    expect(checkMessage("ok", 3)).toBeNull();
    expect(checkMessage("tooLong", 1001)).toBe(messagesHr.support.check.tooLong.replace("{n}", "1001").replace("{max}", "1000"));
    expect(checkMessage("empty", 0)).toBe(messagesHr.support.check.empty);
    expect(checkMessage("invalid", 3)).toBe(messagesHr.support.check.invalid);
  });

  it("no text a step or a check can give has a forbidden term", async () => {
    const texts: string[] = [];
    for (const v of vectors) {
      const result = await submitProblemReport(INPUT, EDITING, NOW, fake(v, "60"));
      const step = (result as { step: FormStep }).step;
      if (step.kind === "failed") texts.push(textOf(step.lead) ?? "", textOf(step.messageKey) ?? "");
    }
    for (const check of ["empty", "tooLong", "invalid"] as const) texts.push(checkMessage(check, 1001) ?? "");
    expect(texts.filter((s) => s === "")).toEqual([]);
    expect(texts.flatMap((text) => findForbiddenTerms(text, "hr"))).toEqual([]);
  });
});
