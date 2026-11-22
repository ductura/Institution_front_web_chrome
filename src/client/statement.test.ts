import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { checkPrintout, type AttachmentLimits } from "./statement";

const limits: AttachmentLimits = { allowedFormats: [{ mimeType: "application/pdf", extension: ".pdf" }], maxBytes: 100 };

describe("statement client (WEB-1503)", () => {
  it("checks format, then size, then emptiness", () => {
    expect(checkPrintout({ name: "a.PDF", type: "application/pdf", size: 10 }, limits).kind).toBe("ok");
    expect(checkPrintout({ name: "a.exe", type: "application/pdf", size: 10 }, limits).kind).toBe("format");
    expect(checkPrintout({ name: "a.pdf", type: "application/pdf", size: 101 }, limits).kind).toBe("tooLarge");
    expect(checkPrintout({ name: "a.pdf", type: "application/pdf", size: 0 }, limits).kind).toBe("empty");
  });

  it("no direct API call in the statement files", () => {
    const root = new URL("../../", import.meta.url);
    const files = [
      "src/client/statement.ts",
      "packages/app/src/host/student/statement/StudentStatement.tsx",
      "packages/app/src/host/student/statement/model.ts",
      "packages/app/src/host/student/statement/messages.hr.ts",
    ];
    for (const file of files) expect(readFileSync(new URL(file, root), "utf8"), file).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|EventSource|WebSocket|Worker)\b|\/api\b|@ductura\/(contracts|test-fakes)/);
  });
});

// ---------------------------------------------------------------------------
// The real adapter over declaration-v1 (PIL-K-IZJAVA-PORT), against a recorded transport.
import { createApi } from "./api";
import contracts from "./migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";
import { createStatementPort, PRINTOUT_MAX_BYTES } from "./statement";

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const UPLOAD_ID = "00000000-0000-4000-8000-0000000000c1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const STATE = {
  state: "none", submitted: false, currentRevision: 1, version: 0, formText: null,
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, draft: null, payload: null, declarationSha256: null,
  uploads: [{ externalAttachmentId: UPLOAD_ID, format: "application/pdf", byteLength: 10, contentSha256: "d".repeat(64) }],
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

function server(answer: (method: string) => Response) {
  const sent: { method: string; path: string; type: string | null; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const type = new Headers(init?.headers).get("content-type");
    sent.push({ method, path: new URL(String(input)).pathname, type, body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body });
    return answer(method);
  };
  const options = { baseUrl: "https://ductura.example.invalid", transport: fetchImpl };
  return { sent, port: createStatementPort(createApi({ baseUrl: options.baseUrl, fetchImpl }), options) };
}
const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

describe("statement adapter (PIL-K-IZJAVA-PORT)", () => {
  it("reads the form, the contract's limits and the latest printout", async () => {
    const read = await server(() => json(200, STATE)).port.read(ASSIGNMENT);
    expect(read).toMatchObject({
      kind: "ready", statementText: "Izmišljeni obrazac.", humanHelp: null, submitted: false,
      attachment: { name: `${UPLOAD_ID}.pdf`, bytes: 10 }, limits: { maxBytes: 2 * 1024 * 1024 },
    });
  });

  it("saves the help as the same PUT, with baseVersion and a body the contract accepts", async () => {
    const s = server((method) => (method === "GET" ? json(200, STATE) : json(200, { ...STATE, state: "draft", version: 1 })));
    expect(await s.port.saveHumanHelp(ASSIGNMENT, { kind: "proofreading", text: " Izmišljena lektura " })).toEqual({ kind: "saved" });
    const put = s.sent.find((r) => r.method === "PUT");
    expect(matchesSchema(contracts["student.declaration.put"].body as Schema, put?.body)).toBe(true);
    expect(put?.body).toMatchObject({
      baseVersion: 0, revision: 1, form: FORM, confirm: false,
      humanHelp: { received: true, entries: [{ kind: "language", text: "Izmišljena lektura" }] },
      ai: { externalAttachmentIds: [UPLOAD_ID] },
    });
  });

  it("a 409 for the version is a conflict, never a quiet success (B-6)", async () => {
    const s = server((method) => (method === "GET" ? json(200, STATE) : error(409, "declaration_conflict")));
    expect(await s.port.saveHumanHelp(ASSIGNMENT, { kind: "none", text: "" })).toEqual({ kind: "conflict" });
    const upload = server(() => error(409, "conflict"));
    expect(await upload.port.attachPrintout(ASSIGNMENT, file("a.pdf", "application/pdf", 10))).toEqual({ kind: "conflict" });
  });

  it("401 is signedOut for the read, the save and the upload", async () => {
    const s = server(() => error(401, "unauthorized"));
    expect(await s.port.read(ASSIGNMENT)).toEqual({ kind: "signedOut" });
    expect(await s.port.saveHumanHelp(ASSIGNMENT, { kind: "none", text: "" })).toEqual({ kind: "signedOut" });
    expect(await s.port.attachPrintout(ASSIGNMENT, file("a.txt", "text/plain", 10))).toEqual({ kind: "signedOut" });
  });

  it("refuses a printout over 2 MB or of another type before anything is sent", async () => {
    const s = server(() => json(200, {}));
    expect(await s.port.attachPrintout(ASSIGNMENT, file("a.pdf", "application/pdf", PRINTOUT_MAX_BYTES + 1))).toEqual({ kind: "rejected" });
    expect(await s.port.attachPrintout(ASSIGNMENT, file("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10))).toEqual({ kind: "rejected" });
    expect(await s.port.attachPrintout(ASSIGNMENT, file("a.pdf", "text/plain", 10))).toEqual({ kind: "rejected" });
    expect(s.sent).toEqual([]);
  });

  it("uploads the printout as raw bytes with its type and checks the answer", async () => {
    const answer = { externalAttachmentId: UPLOAD_ID, format: "text/plain", byteLength: 2097152, contentSha256: "e".repeat(64) };
    const s = server(() => json(200, answer));
    expect(await s.port.attachPrintout(ASSIGNMENT, file("a.txt", "text/plain", PRINTOUT_MAX_BYTES))).toEqual({ kind: "saved" });
    expect(s.sent[0]).toMatchObject({ method: "POST", path: `/api/v1/student/assignments/${ASSIGNMENT}/declaration-attachments`, type: "text/plain" });
    const broken = server(() => json(200, { ...answer, extra: true }));
    expect(await broken.port.attachPrintout(ASSIGNMENT, file("a.txt", "text/plain", 1))).toEqual({ kind: "unavailable" });
  });
});
