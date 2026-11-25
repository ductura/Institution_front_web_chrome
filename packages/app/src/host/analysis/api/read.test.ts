import { describe, expect, it } from "vitest";

import vectors from "@/client/migration-contract-vectors.generated.json" with { type: "json" };
import { ANALYSIS_LIMITS } from "./limits";
import { readCatalogue } from "./read";

const baseUrl = "https://ductura.example.invalid";
type Vector = { route: string; name: string; response: { status: number; body?: unknown; headers?: Record<string, string> } };
const vector = (name: string): Vector["response"] => {
  const found = (vectors as Vector[]).find((entry) => entry.route === "analysis.catalogue.get" && entry.name === name);
  if (found === undefined) throw new Error(`no vector ${name}`);
  return found.response;
};
const answer = (name: string) => async () => {
  const { status, body, headers } = vector(name);
  return Response.json(body, { status, ...(headers === undefined ? {} : { headers }) });
};

describe("katalog analiza (WEB-V15-KLIJENT)", () => {
  it("čita katalog iz ugovora i ograničenja se poklapaju s konstantama", async () => {
    const read = await readCatalogue({ baseUrl, fetchImpl: answer("catalogue") });
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.data.limits).toEqual(ANALYSIS_LIMITS);
    expect(read.data.analyses.map((entry) => entry.id)).toEqual(["descriptive", "frequencies", "correlation"]);
  });

  it("šalje samo GET bez tijela", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(init ?? {});
      expect(String(input)).toBe(`${baseUrl}/api/v1/analysis/catalogue`);
      return answer("catalogue")();
    };
    await readCatalogue({ baseUrl, fetchImpl });
    expect(calls[0]).toMatchObject({ method: "GET", body: undefined });
  });

  it("404 je isključena funkcija, ne prazan katalog", async () => {
    await expect(readCatalogue({ baseUrl, fetchImpl: answer("off") })).resolves.toEqual({ kind: "off" });
  });

  it("503 i prekid veze su nedostupno, nikad prazno", async () => {
    await expect(readCatalogue({ baseUrl, fetchImpl: answer("unavailable") })).resolves.toEqual({ kind: "unavailable" });
    const offline = async () => { throw new Error("offline"); };
    await expect(readCatalogue({ baseUrl, fetchImpl: offline })).resolves.toEqual({ kind: "unavailable" });
  });

  it("401 je greška s kodom, a ne katalog", async () => {
    await expect(readCatalogue({ baseUrl, fetchImpl: answer("unauthorized") })).resolves.toMatchObject({ kind: "failed", status: 401 });
  });

  it("odbija odgovor izvan ugovora (nepoznato polje, drugačija ograničenja)", async () => {
    const good = vector("catalogue").body as { limits: object; analyses: unknown[] };
    for (const body of [
      { ...good, identitet: "x" },
      { ...good, limits: { ...good.limits, maxRows: 5000 } },
      { limits: good.limits },
    ]) {
      const result = await readCatalogue({ baseUrl, fetchImpl: async () => Response.json(body) });
      expect(result.kind, JSON.stringify(body).slice(0, 40)).toBe("failed");
    }
  });
});
