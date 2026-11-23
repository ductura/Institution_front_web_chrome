import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import contracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import { readInterview } from "../../../../../../src/client/work-interview";
import { PAGES, resolve } from "../../../routes";
import { interviewMessages as text } from "./messages.hr";
import { afterNote, afterSend, attachNote, explanationError } from "./model";
import { readOfPreparation, studentInterviewPortWith, type InterviewRead } from "./port";
import StudentInterview from "./StudentInterview";

// PIL-K-RAZGOVOR(-PRILOG): the real student port over work.interview.get, work.interview-explanations.post
// and work.interview-notes.post.
// Invented work and text; no real person.
const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-7";
const Q1 = "5d1b2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const Q2 = "6e2c3d4f-5a6b-4c7d-9e8f-0a1b2c3d4e5f";
const E1 = "7f3d4e5a-6b7c-4d8e-af90-1b2c3d4e5f60";
const N1 = "8a4e5f6b-7c8d-4e9f-b0a1-2c3d4e5f6a7b";
const NOTE_ROUTE = (contracts as unknown as Record<string, { body: Schema; responses: Record<string, { content: { "application/json": { schema: Schema } } }> }>)["work.interview-notes.post"]!;
const AT = "2026-11-20T10:00:00.000Z";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PREPARATION = {
  invitedAt: AT,
  questions: [
    { id: Q1, paragraphRef: "p-3", questionText: "Kako si došla do zaključka o izmišljenoj rijeci?", createdAt: AT, mine: false },
    { id: Q2, paragraphRef: null, questionText: "Koje si izmišljene izvore koristila?", createdAt: AT, mine: false },
  ],
  explanations: [],
  appointment: { place: "Izmišljena dvorana 2", at: "2026-11-25T09:30:00.000Z" },
  heldOn: null,
};

function port(...responses: (Response | Error)[]) {
  const transport = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) transport.mockRejectedValueOnce(r);
    else transport.mockResolvedValueOnce(r);
  }
  return { transport, port: studentInterviewPortWith({ baseUrl: ORIGIN, fetchImpl: transport }) };
}
const html = (read: InterviewRead, attach = false) => {
  const p = studentInterviewPortWith({ baseUrl: ORIGIN, fetchImpl: vi.fn<typeof fetch>() });
  const { attachNote: _notes, ...withoutNotes } = p;
  return renderToStaticMarkup(createElement(StudentInterview, { port: attach ? p : withoutNotes, documentId: DOCUMENT, initial: read }));
};

describe("PIL-K-RAZGOVOR student interview", () => {
  it("before the invitation the server's 403 reads as 'not yet scheduled', not an error or accusation", async () => {
    const { transport, port: real } = port(json(403, { error: "forbidden" }));
    const read = await real.read(DOCUMENT);
    expect(read.kind).toBe("notInvited");
    expect(String(transport.mock.calls[0]?.[0])).toContain(`/api/v1/works/${DOCUMENT}/interview`);
    const out = html(read);
    expect(out.toLowerCase()).toContain("razgovor još nije zakazan");
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain(text.unavailable);
    for (const word of ["optuž", "sumnj", "sankcij", "prekrš", "varanj", "plagij"]) expect(out.toLowerCase()).not.toContain(word);
  });

  it("the teacher's read keeps its old answer to 403", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json(403, { error: "forbidden" }));
    expect((await readInterview(DOCUMENT, { baseUrl: ORIGIN, fetchImpl: transport })).kind).toBe("unavailable");
  });

  it("shows exactly the questions the server reveals, and none before the invitation", async () => {
    const { port: real } = port(json(200, PREPARATION));
    const read = await real.read(DOCUMENT);
    if (read.kind !== "ready") throw new Error("expected ready");
    expect(read.questions.map((q) => q.id)).toEqual([Q1, Q2]);
    const out = html(read);
    for (const q of PREPARATION.questions) expect(out).toContain(q.questionText);
    expect(out).toContain("Izmišljena dvorana 2");
    expect(out.match(/<li>/g)?.length).toBe(2);
    const hidden = readOfPreparation({ ...PREPARATION, invitedAt: null } as never);
    expect(hidden.kind).toBe("notInvited");
    expect(html(hidden)).not.toContain(PREPARATION.questions[0]!.questionText);
  });

  it("lists an explanation as sent only once the server confirms it", async () => {
    const { port: real0 } = port(json(200, PREPARATION));
    const ready = await real0.read(DOCUMENT);
    if (ready.kind !== "ready") throw new Error("expected ready");
    const draft = "Izmišljeno objašnjenje o izmišljenoj rijeci.";

    const { port: down } = port(json(503, { error: "unavailable" }));
    const failed = afterSend(ready, await down.explain(DOCUMENT, { questionId: Q1, text: draft }));
    expect(failed.sent).toBe(false);
    expect(failed.message).toBe(text.failed);
    expect(html(failed.read)).not.toContain(draft);

    const { port: refusing } = port(json(422, { error: "invalid_input" }));
    expect(afterSend(ready, await refusing.explain(DOCUMENT, { questionId: Q1, text: draft })).message).toBe(text.rejected);

    const { transport, port: real } = port(json(201, { id: E1, questionId: Q1, text: draft, createdAt: AT }));
    const done = afterSend(ready, await real.explain(DOCUMENT, { questionId: Q1, text: draft }));
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(String(url)).toContain(`/api/v1/works/${DOCUMENT}/interview/explanations`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ questionId: Q1, text: draft });
    expect(done.sent).toBe(true);
    expect(done.message).toBe(text.sent);
    expect(done.read.explanations).toEqual([{ id: E1, questionId: Q1, text: draft }]);
    expect(html(done.read)).toContain(draft);
  });

  it("holds an explanation to the contract's 2000 characters", () => {
    expect(explanationError("a".repeat(2000))).toBeNull();
    expect(explanationError("a".repeat(2001))).toBe(text.errors.tooLong.replace("{max}", "2000"));
  });

  it("offers the note action to an invited student until the talk is held, and never without a port route", async () => {
    const { port: real } = port(json(200, PREPARATION));
    const read = await real.read(DOCUMENT);
    if (read.kind !== "ready") throw new Error("expected ready");
    expect(real.attachNote).toBeTypeOf("function");
    expect(html(read, true)).toContain('type="file"');
    expect(html(read, true)).toContain('accept=".pdf,.txt"');
    expect(html(read)).not.toContain('type="file"');
    expect(html({ ...read, heldAt: "2026-11-21" }, true)).not.toContain('type="file"');
    expect(html({ kind: "notInvited" }, true)).not.toContain('type="file"');
  });

  it("sends a note whose body passes the contract's schema, and lists it only once the server confirms it", async () => {
    const { port: real0 } = port(json(200, PREPARATION));
    const ready = await real0.read(DOCUMENT);
    if (ready.kind !== "ready") throw new Error("expected ready");
    const content = "Izmišljene bilješke za razgovor o izmišljenoj rijeci.";
    const note = new File([new TextEncoder().encode(content)], "biljeske.txt", { type: "text/plain" });
    const stored = { id: N1, fileName: "biljeske.txt", mediaType: "text/plain", byteSize: new TextEncoder().encode(content).length, sha256: "a".repeat(64), createdAt: AT };
    expect(matchesSchema(NOTE_ROUTE.responses["201"]!.content["application/json"].schema, stored)).toBe(true);

    const { port: down } = port(json(503, { error: "unavailable" }));
    const failed = afterNote(ready, await attachNote(down, DOCUMENT, note) as never);
    expect(failed).toMatchObject({ saved: false, message: text.noteFailed });
    expect(html(failed.read, true)).not.toContain(`${text.attached}: biljeske.txt`);

    const { transport, port: real } = port(json(201, stored));
    const done = afterNote(ready, await attachNote(real, DOCUMENT, note) as never);
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(String(url)).toContain(`/api/v1/works/${DOCUMENT}/interview/notes`);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as { contentBase64: string };
    expect(matchesSchema(NOTE_ROUTE.body, body)).toBe(true);
    expect(body).toEqual({ fileName: "biljeske.txt", mediaType: "text/plain", contentBase64: Buffer.from(content).toString("base64") });
    expect(done).toMatchObject({ saved: true, message: text.noteSaved });
    expect(html(done.read, true)).toContain(`${text.attached}: biljeske.txt`);

    const pdf = new File([new TextEncoder().encode("%PDF-1.7 izmišljeno")], "biljeske.pdf");
    const { transport: pdfTransport, port: pdfPort } = port(json(201, { ...stored, fileName: "biljeske.pdf", mediaType: "application/pdf" }));
    await attachNote(pdfPort, DOCUMENT, pdf);
    const pdfBody = JSON.parse(String(pdfTransport.mock.calls[0]?.[1]?.body));
    expect(matchesSchema(NOTE_ROUTE.body, pdfBody)).toBe(true);
    expect(pdfBody.mediaType).toBe("application/pdf");
  });

  it("refuses a disallowed type or an oversized note before sending, and maps 409 to a closed action", async () => {
    const { transport, port: real } = port(json(409, { error: "conflict" }));
    for (const f of [new File(["x"], "skripta.exe"), new File([new Uint8Array(1024 * 1024 + 1)], "velike.txt")]) {
      expect((await attachNote(real, DOCUMENT, f)).kind).toBe("invalid");
    }
    expect(transport).not.toHaveBeenCalled();
    expect(await attachNote(real, DOCUMENT, new File(["Izmišljeno."], "kasno.txt"))).toEqual({ kind: "closed" });
    expect(transport).toHaveBeenCalledTimes(1);
    const { port: refused } = port(json(403, { error: "forbidden" }));
    expect((await attachNote(refused, DOCUMENT, new File(["Izmišljeno."], "rano.txt"))).kind).toBe("notInvited");
  });

  it("is a student page of PAGES", () => {
    expect(PAGES.some((p) => p.path === "/rad/[assignmentId]/razgovor" && p.roles.join() === "student")).toBe(true);
    expect(resolve("/rad/zadatak-1/razgovor", "student").kind).toBe("page");
    expect(resolve("/rad/zadatak-1/razgovor", "teacher").kind).toBe("redirect");
  });
});
