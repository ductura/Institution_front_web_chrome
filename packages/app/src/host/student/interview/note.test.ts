import { describe, expect, it, vi } from "vitest";

import contracts from "../../../../../../src/client/migration-contracts.generated.json";
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import { interviewMessages as text } from "./messages.hr";
import { afterAttach, attachNote, canAttach } from "./model";
import { NOTE_MAX_BYTES, noteBody, studentInterviewPortWith, type InterviewRead } from "./port";

// PIL-K-RAZGOVOR-PRILOG: the student's note over work.interview-notes.post (SRV #644). Invented work and text.
const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-7";
const NOTE_ID = "8a4e5f6b-7c8d-4e9f-a0b1-2c3d4e5f6a70";
const AT = "2026-11-24T11:00:00.000Z";
const TEXT = "Bilješka uz razgovor: popis izvora koje sam čitala.\n";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const READY: Extract<InterviewRead, { kind: "ready" }> = {
  kind: "ready", workTitle: null, questions: [], slot: null, heldAt: null, explanations: [], attachments: [],
};
const stored = (fileName: string) => ({
  id: NOTE_ID, fileName, mediaType: "text/plain", byteSize: 54, sha256: "a".repeat(64), createdAt: AT,
});

function port(...responses: Response[]) {
  const transport = vi.fn<typeof fetch>();
  for (const r of responses) transport.mockResolvedValueOnce(r);
  return { transport, port: studentInterviewPortWith({ baseUrl: ORIGIN, fetchImpl: transport }) };
}
const route = (contracts as unknown as Record<string, { path: string; method: string; body: Schema }>)["work.interview-notes.post"]!;

describe("PIL-K-RAZGOVOR-PRILOG student note", () => {
  it("sends a body that passes the contract's schema, for a text and a PDF", async () => {
    const txt = await noteBody(new File([TEXT], " biljeska.txt "));
    expect(txt).toEqual({ fileName: "biljeska.txt", mediaType: "text/plain", contentBase64: Buffer.from(TEXT).toString("base64") });
    expect(matchesSchema(route.body, txt)).toBe(true);
    const pdf = await noteBody(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "Bilješke.PDF"));
    expect(pdf?.mediaType).toBe("application/pdf");
    expect(matchesSchema(route.body, pdf)).toBe(true);
    expect(route.path).toBe("/api/v1/works/{documentId}/interview/notes");
    expect(route.method).toBe("POST");
  });

  it("lists the note only once the server confirms it, under the server's name", async () => {
    const { transport, port: real } = port(json(201, stored("biljeska.txt")));
    const result = await attachNote(real, DOCUMENT, new File([TEXT], "biljeska.txt"));
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${ORIGIN}/api/v1/works/${DOCUMENT}/interview/notes`);
    expect(init?.method).toBe("POST");
    expect(matchesSchema(route.body, JSON.parse(String(init?.body)))).toBe(true);
    const done = afterAttach(READY, result as never);
    expect(done).toEqual({ read: { ...READY, attachments: ["biljeska.txt"] }, message: text.noteSaved, saved: true });

    for (const [status, message] of [[503, text.noteFailed], [422, text.noteRejected], [409, text.noteHeld]] as const) {
      const { port: refusing } = port(json(status, { error: status === 409 ? "conflict" : "x" }));
      const next = afterAttach(READY, await attachNote(refusing, DOCUMENT, new File([TEXT], "biljeska.txt")) as never);
      expect(next).toEqual({ read: READY, message, saved: false });
    }
  });

  it("refuses a type the contract does not take, an oversized note or a long name before sending", async () => {
    const { transport, port: real } = port();
    for (const file of [
      new File([TEXT], "biljeske.md"),
      new File([TEXT], "biljeske.exe"),
      new File([new Uint8Array(NOTE_MAX_BYTES + 1)], "velika.txt"),
      new File([], "prazna.txt"),
      new File([TEXT], `${"a".repeat(197)}.txt`),
    ]) expect((await attachNote(real, DOCUMENT, file)).kind).toBe("invalid");
    expect(transport).not.toHaveBeenCalled();
    expect((await attachNote(real, DOCUMENT, new File([new Uint8Array(NOTE_MAX_BYTES).fill(65)], "tocno.txt"))).kind).toBe("unavailable");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("is not offered before the invitation or after the interview is held", () => {
    expect(canAttach(READY)).toBe(true);
    expect(canAttach({ ...READY, heldAt: "2026-11-25" })).toBe(false);
    expect(canAttach({ kind: "notInvited" })).toBe(false);
  });

  it("an ended session reads as such", async () => {
    const { port: real } = port(json(401, { error: "unauthorized" }));
    expect((await attachNote(real, DOCUMENT, new File([TEXT], "biljeska.txt"))).kind).toBe("signedOut");
  });
});
