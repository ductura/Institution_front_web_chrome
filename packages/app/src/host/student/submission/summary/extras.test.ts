import { describe, expect, it } from "vitest";

import { readAssistant, readDeclarationBlocks, readExtras, readProvenance, readVersions } from "./extras";

// Invented answers; the call is the shared client's shape, answering by operation id.
type Answer = { ok: true; status: 200; body: unknown } | { ok: false; status: number };
const call = (answers: Record<string, Answer>) =>
  (async (id: string) => answers[id] ?? { ok: false, status: 503 }) as unknown as Parameters<typeof readVersions>[1];
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const GUID = "00000000-0000-4000-8000-000000000001";

describe("process summary extras (F4-PRE-R04)", () => {
  it("lists the versions from work.versions.get and says so when the read fails", async () => {
    const read = await readVersions("d1", call({ "work.versions.get": ok({ versions: [
      { kind: "submission", revision: 4, savedMinute: "2026-11-05T20:05:00.000Z" },
      { kind: "checkpoint", revision: 3, savedMinute: "2026-11-05T19:00:00.000Z" },
    ], nextBeforeRevision: 3 }) }));
    expect(read).toEqual({ kind: "ready", value: { more: true, lines: [
      "Verzija 4 · predana · 5. 11. 2026. u 21:05", "Verzija 3 · radna · 5. 11. 2026. u 20:00",
    ] } });
    expect(await readVersions("d1", call({}))).toEqual({ kind: "unavailable" });
  });

  it("names the Assistant's state and counts requests, never costs", async () => {
    const conversations = [{ conversationId: GUID, purposeKey: "x", createdAt: "2026-11-05T10:00:00.000Z", requestCount: 3, lastActivityAt: "2026-11-05T10:30:00.000Z" }];
    expect(await readAssistant("a1", call({ "student.assignment-assistant.get": ok({ assistantEnabled: false }) })))
      .toEqual({ kind: "ready", value: { enabled: false, lines: [] } });
    const on = await readAssistant("a1", call({ "student.assignment-assistant.get": ok({ assistantEnabled: true }), "student.assistant-conversations.get": ok({ assignmentId: GUID, conversations }) }));
    expect(on).toEqual({ kind: "ready", value: { enabled: true, lines: ["Razgovor · 3 upita · zadnja aktivnost 5. 11. 2026. u 11:30"] } });
    // A failed conversations read is "unavailable", not "no conversations".
    expect(await readAssistant("a1", call({ "student.assignment-assistant.get": ok({ assistantEnabled: true }) }))).toEqual({ kind: "unavailable" });
    // Another student's assignment is a 404: nothing is shown.
    expect(await readAssistant("tuđe", call({ "student.assignment-assistant.get": { ok: false, status: 404 } }))).toEqual({ kind: "unavailable" });
  });

  it("shows the declaration's two blocks from the confirmed payload, none without a declaration", async () => {
    const body = { ownWork: { confirmed: true }, humanHelp: { received: true, entries: [{ kind: "language", text: "Izmišljena lektura." }] },
      ai: { use: "used", declaredTools: [{ toolLabel: "Alat A", purposeText: "ideje", phaseText: "početak" }], attachments: [], externalAttachmentIds: [] }, revision: 4 };
    const read = await readDeclarationBlocks("a1", call({ "student.declaration.get": ok({ payload: { ...body, confirmedAt: "2026-11-05T20:00:00.000Z" }, draft: null }) }));
    expect(read).toEqual({ kind: "ready", value: {
      recorded: ["Izjava se odnosi na verziju 4.", "Potvrđena 5. 11. 2026. u 21:00."],
      student: ["Vlastiti rad: potvrđeno.", "Tuđa pomoć: primljena. jezik: Izmišljena lektura.", "Generativna umjetna inteligencija: korištena.", "Alat A · ideje · početak"],
    } });
    expect(await readDeclarationBlocks("a1", call({ "student.declaration.get": ok({ payload: null, draft: null }) }))).toEqual({ kind: "ready", value: null });
  });

  it("labels the provenance shares and marks, and fails as a whole when one read fails", async () => {
    const kinds = ["typed", "assistant_inserted", "assistant_match", "imported_file", "pasted_known", "pasted_unknown"];
    const parts = kinds.map((kind, i) => ({ kind, percent: i === 0 ? 80 : i === 5 ? 20 : 0 }));
    const segments = [{ blockId: GUID, start: 0, end: 5, kind: "pasted_unknown", segmentRef: null }];
    const read = await readProvenance("d1", call({ "work.origin-composition.get": ok({ parts }), "work.origin-segments.get": ok({ revision: 4, segments }) }));
    expect(read.kind === "ready" && read.value.shares[0]).toBe("Tipkano: 80 %");
    expect(read.kind === "ready" && read.value.marks).toEqual(["Zalijepljeno, izvor nepoznat: 1"]);
    expect(await readProvenance("d1", call({ "work.origin-composition.get": ok({ parts }) }))).toEqual({ kind: "unavailable" });
  });

  it("readExtras settles each part alone", async () => {
    const parts: string[] = [];
    readExtras("a1", "d1", call({}), (p) => parts.push(...Object.keys(p)));
    await new Promise((r) => setTimeout(r, 0));
    expect(parts.sort()).toEqual(["assistant", "declaration", "provenance", "versions"]);
  });
});
