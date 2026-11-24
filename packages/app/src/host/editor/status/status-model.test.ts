import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { readProofRequests, rehearsalSupplements, selectedLabel, uncitedSources, type ProofsRead, type SupplementReads } from "./status-model";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+", attrs: { sources: { default: [] } } },
    paragraph: { content: "inline*" },
    text: { group: "inline" },
    citation: { group: "inline", inline: true, atom: true, attrs: { sourceId: { default: null }, locator: { default: null } } },
  },
});
const source = (id: string, family: string) => ({ id, year: 2020, authors: [{ kind: "person", family }] });
const docOf = (sources: object[], cited: string[]) => schema.node("doc", { sources }, [
  schema.node("paragraph", null, cited.map((sourceId) => schema.node("citation", { sourceId }))),
]);

describe("selectedLabel", () => {
  it("is empty for a caret and counts words otherwise", () => {
    expect(selectedLabel(0)).toBeNull();
    expect(selectedLabel(1)).toBe("označeno: 1 riječ");
    expect(selectedLabel(12)).toBe("označeno: 12 riječi");
  });
});

describe("uncited sources", () => {
  it("counts sources without a citation", () => {
    expect(uncitedSources(docOf([source(A, "Kovač"), source(B, "Horvat")], [A]))).toEqual({ total: 2, uncited: 1 });
  });
  it("gives a row per state and 'unavailable' for what has no source yet", () => {
    const all = rehearsalSupplements(docOf([source(A, "Kovač")], [A]));
    expect(all.uncited?.detail).toBe("Svi izvori su citirani.");
    expect(rehearsalSupplements(docOf([source(A, "Kovač"), source(B, "Horvat")], [A])).uncited?.detail).toBe("Necitirano: 1.");
    expect(rehearsalSupplements(docOf([], [])).uncited?.detail).toBe("Još nema izvora u radu.");
    expect(rehearsalSupplements(null).uncited?.detail).toBe("Podatak trenutačno nije dostupan.");
    // WEB-NUZ-PREDAJA-1 (P-16): without a read the rows say why they cannot say, never a count.
    expect(all.facultyRequirements?.detail).toBe("Provjera pravila fakulteta još nije dostupna.");
    expect(all.proofs?.detail).toBe("Zatražene potvrde trenutačno nije moguće učitati.");
    expect(all.forms?.detail).toBe("Podatak trenutačno nije dostupan.");
  });
});

// WEB-NUZ-PREDAJA-1 (P-16): the rehearsal's rows from the server instead of a lasting "unavailable".
describe("rehearsal rows from the server", () => {
  const doc = docOf([], []);
  const FORM = { formId: "test-izjava", formVersion: 1 };
  it("names the faculty's form from student.declaration.get, or why it cannot", () => {
    const forms = (gate: SupplementReads["gate"]) => rehearsalSupplements(doc, { gate }).forms?.detail;
    expect(forms({ kind: "missing", detail: "draft", form: FORM })).toBe("Obrazac izjave: test-izjava, verzija 1.");
    expect(forms({ kind: "confirmed", detail: "bound", confirmedAt: null, form: FORM })).toBe("Obrazac izjave: test-izjava, verzija 1.");
    expect(forms({ kind: "missing", detail: "none", form: null })).toBe("Obrazac izjave još nije objavljen.");
    expect(forms({ kind: "not_required" })).toBe("Zadatak ne traži obrazac izjave.");
    expect(forms({ kind: "loading" })).toBe("Provjeravam izjavu na poslužitelju…");
    expect(forms({ kind: "unavailable" })).toBe("Podatak trenutačno nije dostupan.");
  });
  it("counts the mentor's open requests for proofs", () => {
    const proofs = (read: ProofsRead) => rehearsalSupplements(doc, { proofs: read }).proofs?.detail;
    expect(proofs({ kind: "ready", total: 0, open: 0 })).toBe("Mentor za sada nije zatražio potvrde.");
    expect(proofs({ kind: "ready", total: 3, open: 2 })).toBe("Još 2 od 3 čeka potvrdu.");
    expect(proofs({ kind: "ready", total: 2, open: 0 })).toBe("Nema otvorenih zahtjeva za potvrdu.");
    expect(proofs({ kind: "loading" })).toBe("Provjeravam zatražene potvrde…");
  });
  it("reads student.source-proof-requests.get through the client and nothing else", async () => {
    const request = (closedAt: string | null) => ({ id: "x", sourceId: "y", instruction: "Izmišljena uputa.", dueAt: "2026-12-01T10:00:00.000Z", createdAt: "2026-11-20T10:00:00.000Z", closedAt });
    const calls: unknown[] = [];
    const call = async (id: string, input: unknown) => { calls.push([id, input]); return { ok: true, status: 200, body: { proofRequests: [request(null), request("2026-11-21T10:00:00.000Z")] } }; };
    await expect(readProofRequests(call, A)).resolves.toEqual({ kind: "ready", total: 2, open: 1 });
    expect(calls).toEqual([["student.source-proof-requests.get", { params: { assignmentId: A }, query: undefined, body: undefined }]]);
    await expect(readProofRequests(async () => ({ ok: false, status: 503 }), A)).resolves.toEqual({ kind: "unavailable" });
    await expect(readProofRequests(async () => ({ ok: true, status: 200, body: {} }), A)).resolves.toEqual({ kind: "unavailable" });
    await expect(readProofRequests(async () => { throw new TypeError("offline"); }, A)).resolves.toEqual({ kind: "unavailable" });
  });
});
