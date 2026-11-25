import { describe, expect, it } from "vitest";

import vectors from "@/client/migration-contract-vectors.generated.json" with { type: "json" };
import { runAnalysis, type AnalysisRequest } from "./run";

const baseUrl = "https://ductura.example.invalid";
type Vector = { route: string; name: string; request: { body?: AnalysisRequest }; response: { status: number; body?: unknown } };
const vector = (name: string): Vector => {
  const found = (vectors as Vector[]).find((entry) => entry.route === "analysis.runs.post" && entry.name === name);
  if (found === undefined) throw new Error(`no vector ${name}`);
  return found;
};
const request = (name = "descriptive"): AnalysisRequest => {
  const body = vector(name).request.body;
  if (body === undefined) throw new Error("no body");
  return body;
};
const answering = (name: string) => async () => Response.json(vector(name).response.body, { status: vector(name).response.status });
const answerStatus = (status: number, code: string) => async () => Response.json({ error: code, code, messageKey: `errors.${code}`, status, requestId: "00000000-0000-4000-8000-000000000001" }, { status });

describe("izračun analize (WEB-V15-KLIJENT)", () => {
  it.each(["descriptive", "frequencies", "correlation", "correlation-too-few-pairs"])("%s: vraća rezultat iz ugovora, null ostaje null", async (name) => {
    const run = await runAnalysis(request(name), { baseUrl, fetchImpl: answering(name) });
    expect(run).toEqual({ kind: "ready", data: vector(name).response.body });
  });

  it("šalje POST s tijelom točno kao u ugovoru i bez identiteta", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      sent.push({ url: String(input), init: init ?? {} });
      return answering("descriptive")();
    };
    await runAnalysis(request(), { baseUrl, fetchImpl });
    expect(sent[0]?.url).toBe(`${baseUrl}/api/v1/analysis/runs`);
    expect(sent[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual(request());
  });

  it("404 je isključena funkcija", async () => {
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: answering("not-found") })).resolves.toEqual({ kind: "off" });
  });

  it("503 i prekid veze su nedostupno", async () => {
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: answering("unavailable") })).resolves.toEqual({ kind: "unavailable" });
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });

  it("413 je prevelik zahtjev", async () => {
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: answerStatus(413, "body_too_large") })).resolves.toEqual({ kind: "tooLarge" });
  });

  it.each(["unknown-variable", "wrong-kind", "unknown-version"])("422 %s je nevaljan unos s kodom", async (name) => {
    const run = await runAnalysis(request(), { baseUrl, fetchImpl: answering(name) });
    expect(run).toEqual({ kind: "invalid", code: vector(name).response.status === 422 ? (vector(name).response.body as { code: string }).code : "" });
  });

  it("zahtjev izvan ugovora klijent odbija prije slanja (nepoznato polje, 13 stupaca)", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => { calls += 1; return answering("descriptive")(); };
    const extra = { ...request(), identitet: "x" } as AnalysisRequest;
    const wide = { ...request(), columns: Array.from({ length: 13 }, (_, i) => ({ name: `s${i}`, kind: "numeric" as const })) };
    for (const bad of [extra, wide]) {
      await expect(runAnalysis(bad, { baseUrl, fetchImpl })).resolves.toEqual({ kind: "invalid", code: "client_rejected" });
    }
    expect(calls).toBe(0);
  });

  it("401, 403 i odgovor izvan ugovora su failed, ne rezultat", async () => {
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: answerStatus(401, "unauthorized") })).resolves.toMatchObject({ kind: "failed", status: 401 });
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: answerStatus(403, "origin_mismatch") })).resolves.toMatchObject({ kind: "failed", status: 403 });
    const extra = { ...(vector("descriptive").response.body as object), identitet: "x" };
    await expect(runAnalysis(request(), { baseUrl, fetchImpl: async () => Response.json(extra) })).resolves.toMatchObject({ kind: "failed" });
  });
});
