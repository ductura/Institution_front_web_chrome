import { describe, expect, it } from "vitest";

import { readSystemHealth } from "./read";
import { healthRows, isDegraded } from "./view";

const baseUrl = "https://ductura.example.invalid";
const health = { status: "ok", state: "ok", apiVersion: "1.154.0", serverVersion: "1.154.0", minClientVersion: "1.0.0" };
const ready = { status: "ready", capabilities: { database: "ok", storage: "ok", signing: "nedostupno", queue: "nije_konfigurirano" } };
const answer = (healthResponse: () => Response, readyResponse: () => Response) => async (input: RequestInfo | URL) =>
  String(input).endsWith("/ready") ? readyResponse() : healthResponse();

describe("stanje sustava", () => {
  it("čita obje probe i ne zaokružuje nedostupne usluge u 'u redu'", async () => {
    const result = await readSystemHealth({ baseUrl, fetchImpl: answer(() => Response.json(health), () => Response.json(ready)) });
    expect(result).toEqual({ kind: "ready", data: { health, ready, notReady: null } });
    if (result.kind !== "ready") throw new Error("expected ready");
    const rows = healthRows(result.data);
    expect(rows.find((r) => r.id === "ready-signing")?.value).toBe("nedostupno");
    expect(rows.find((r) => r.id === "ready-queue")?.value).toBe("nije podešeno");
    expect(isDegraded(result.data)).toBe(true);
  });

  it("503 na /ready je stanje poslužitelja, a ne greška stranice", async () => {
    const result = await readSystemHealth({ baseUrl, fetchImpl: answer(() => Response.json(health), () => Response.json({ code: "draining" }, { status: 503 })) });
    expect(result).toMatchObject({ kind: "ready", data: { ready: null, notReady: "draining" } });
    const other = await readSystemHealth({ baseUrl, fetchImpl: answer(() => Response.json(health), () => Response.json({ code: "unavailable" }, { status: 503 })) });
    expect(other).toMatchObject({ kind: "ready", data: { ready: null, notReady: "not_ready" } });
  });

  it("neuspjela ili neispravna probe nikad ne daje zeleno stanje", async () => {
    await expect(readSystemHealth({ baseUrl, fetchImpl: answer(() => Response.json({}, { status: 500 }), () => Response.json(ready)) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readSystemHealth({ baseUrl, fetchImpl: answer(() => Response.json({ status: "ok", host: "db.internal" }), () => Response.json(ready)) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readSystemHealth({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });

  it("što poslužitelj ne javlja, stranica kaže da ne javlja", async () => {
    const rows = healthRows({ health: { status: "ok" }, ready: null, notReady: "not_ready" });
    expect(rows.find((r) => r.id === "database")?.value).toBe("Poslužitelj to ne javlja");
    expect(rows.find((r) => r.id === "ready-queue")?.value).toBe("Poslužitelj to ne javlja");
  });
});
