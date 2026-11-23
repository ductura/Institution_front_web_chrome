// @vitest-environment jsdom
// PIL-K-AI-PRILOZI: N-07 „Što je student predao” reads the declaration and its AI attachments
// through the real teacher port (teacher.work.get, then teacher.declaration.get), on a recorded
// transport. Invented data only. A .ts file (createElement), so the host's vitest include runs it.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api.ts";
import AiDeclarationSection from "./AiDeclarationSection";
import { createTeacherDeclarationPort } from "./ports";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCUMENT = "izmisljeni-dokument-1";
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const STUDENT = "00000000-0000-4000-8000-0000000000d1";
const PRINTOUT = "00000000-0000-4000-8000-0000000000c1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };

const WORK = {
  documentId: DOCUMENT, studentId: STUDENT, studentName: "Izmišljena Studentica", assignmentId: ASSIGNMENT,
  state: "predano", prevDocumentId: null, nextDocumentId: null,
};
const BOUND = {
  state: "bound", declarationSha256: "b".repeat(64), payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "d1000000-0000-4000-8000-000000000001", declarationVersion: 1,
    principalId: STUDENT, assignmentId: ASSIGNMENT, assignmentVersion: 1, documentId: DOCUMENT, revision: 3,
    form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
    ai: {
      use: "used",
      declaredTools: [{ toolLabel: "Izmišljeni alat", purposeText: "Izmišljena lektura", phaseText: "Pisanje" }],
      recorded: [],
      attachments: [{ externalAttachmentId: PRINTOUT, format: "application/pdf", byteLength: 10, contentSha256: "d".repeat(64), reason: "external_upload" }],
    },
    confirmedAt: "2026-11-20T10:00:00.000000Z",
  },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

/** A recorded server: the work read, then the declaration read, each answered by `answer`. */
function server(answer: { work: () => Response; declaration: () => Response }) {
  const sent: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    sent.push(path);
    return path.endsWith("/declaration") ? answer.declaration() : answer.work();
  };
  return { sent, call: createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }) };
}

let root: Root | null = null;
let host: HTMLElement | null = null;

async function show(call: ReturnType<typeof createApi>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(AiDeclarationSection, { port: createTeacherDeclarationPort(call), submissionId: DOCUMENT }));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

const ERROR = "Izjavu i priložene razgovore trenutačno nije moguće učitati.";

describe("N-07 declaration through the teacher port (PIL-K-AI-PRILOZI)", () => {
  it("reads the student's declaration and AI attachments through the port", async () => {
    const s = server({ work: () => json(200, WORK), declaration: () => json(200, BOUND) });
    const el = await show(s.call);
    expect(s.sent).toEqual([
      `/api/v1/teacher/works/${DOCUMENT}`,
      `/api/v1/teacher/assignments/${ASSIGNMENT}/students/${STUDENT}/declaration`,
    ]);
    expect(el.textContent).toContain("Izmišljena lektura");
    expect(el.textContent).toContain("Izmišljeni alat");
    expect(el.textContent).toContain("Vanjski alat, izjavljeno (1)");
    expect(el.textContent).toContain(`${PRINTOUT}.pdf`);
    expect(el.textContent).not.toContain(ERROR);
  });

  it("says the declaration is pending when the student has none yet", async () => {
    const s = server({ work: () => json(200, WORK), declaration: () => json(200, { state: "none", payload: null, declarationSha256: null }) });
    expect((await show(s.call)).textContent).toContain("Dopuna na čekanju");
  });

  const failures: [string, { work: () => Response; declaration: () => Response }][] = [
    ["the declaration route is missing", { work: () => json(200, WORK), declaration: () => error(404, "not_found") }],
    ["the declaration route fails", { work: () => json(200, WORK), declaration: () => error(500, "internal") }],
    ["the network fails", { work: () => json(200, WORK), declaration: () => { throw new TypeError("offline"); } }],
    ["the work route fails", { work: () => error(503, "unavailable"), declaration: () => json(200, BOUND) }],
    ["the work route names another work", { work: () => json(200, { ...WORK, documentId: "drugi-dokument" }), declaration: () => json(200, BOUND) }],
    ["the session has ended", { work: () => error(401, "unauthenticated"), declaration: () => json(200, BOUND) }],
    ["the declaration route says the session has ended", { work: () => json(200, WORK), declaration: () => error(401, "unauthenticated") }],
    ["the declaration route refuses this teacher", { work: () => json(200, WORK), declaration: () => error(403, "forbidden") }],
  ];
  for (const [when, answer] of failures) {
    it(`says it cannot load, not an empty declaration, when ${when}`, async () => {
      const el = await show(server(answer).call);
      expect(el.textContent).toContain(ERROR);
      expect(el.textContent).toContain("Pokušaj ponovno");
      expect(el.textContent).not.toContain("nije koristio/koristila AI alate");
      expect(el.textContent).not.toMatch(/\(0\)/u);
    });
  }

  it("never reads or writes the student's half", async () => {
    const s = server({ work: () => json(200, WORK), declaration: () => json(200, BOUND) });
    const port = createTeacherDeclarationPort(s.call);
    expect(await port.readStudent(ASSIGNMENT)).toEqual({ kind: "unavailable" });
    expect(await port.confirm(ASSIGNMENT, [])).toEqual({ kind: "unavailable" });
    expect(s.sent).toEqual([]);
  });
});
