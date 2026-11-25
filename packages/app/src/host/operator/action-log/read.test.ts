import { describe, expect, it } from "vitest";

import { readActionLog, type ActionLogData } from "./read";
import { rowsOf } from "./view";

const baseUrl = "https://ductura.example.invalid";
const demo: ActionLogData = {
  truncated: false,
  entries: [
    { at: "2026-11-20T09:00:00.000Z", actorRole: "institution_admin", action: "rule_published", subjectRole: null, outcome: "completed" },
    { at: "2026-11-22T10:30:00.000Z", actorRole: "operator", action: "role_confirmed", subjectRole: "teacher", outcome: "completed" },
  ],
};

describe("dnevnik radnji (NF-7 OA-3)", () => {
  it("čita samo zapis iz ugovora i vraća ga netaknutog", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => { calls.push(`${init?.method} ${new URL(String(url)).pathname}`); return Response.json(demo); };
    await expect(readActionLog({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "ready", data: demo });
    expect(calls).toEqual(["GET /api/v1/institution/admin-actions"]);
  });

  it("prazan zapis je ishod 'prazno', ne greška", async () => {
    const empty = { entries: [], truncated: false };
    await expect(readActionLog({ baseUrl, fetchImpl: async () => Response.json(empty) })).resolves.toEqual({ kind: "ready", data: empty });
  });

  it.each([401, 403])("odgovor %s je 'nema ovlasti'", async (status) => {
    await expect(readActionLog({ baseUrl, fetchImpl: async () => Response.json({ error: "forbidden" }, { status }) })).resolves.toEqual({ kind: "denied" });
  });

  it("greška poslužitelja, mreže ili odgovor izvan ugovora je 'nedostupno'", async () => {
    await expect(readActionLog({ baseUrl, fetchImpl: async () => Response.json({ error: "unavailable" }, { status: 503 }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readActionLog({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
    await expect(readActionLog({ baseUrl, fetchImpl: async () => Response.json({ ...demo, entries: [{ ...demo.entries[0], studentName: "x" }] }) })).resolves.toEqual({ kind: "unavailable" });
  });

  it("redovi idu od najnovijeg, s ulogama riječima", () => {
    const rows = rowsOf(demo.entries);
    expect(rows.map((r) => [r.action, r.actor, r.subject])).toEqual([
      ["Uloga potvrđena", "operater", "nastavnik"],
      ["Pravilo objavljeno", "administrator fakulteta", "—"],
    ]);
  });
});
