// PIL-K-IZJAVA-VRATA: an invented server for the declaration gate in the steps' component tests.
import { createApi, type ApiOptions } from "../../../../../../../src/client/api.ts";
import { readDeclarationGate } from "../../../../../../../src/client/declaration.ts";
import type { GateRead } from "./declaration-gate";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const BASE = {
  submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, declarationSha256: null, uploads: [],
};
/** Asked for and only drafted: sending stays closed. */
export const DRAFT = {
  ...BASE, state: "draft", payload: null,
  draft: {
    baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false }, humanHelp: { received: false, entries: [] },
    ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] }, confirm: false,
  },
};
/** Confirmed for revision 2, the current one. */
export const CONFIRMED = {
  ...BASE, state: "confirmed", version: 5, draft: null, declarationSha256: "d".repeat(64),
  payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
    principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId: ASSIGNMENT, assignmentVersion: 1,
    documentId: "izmisljeni-dokument-1", revision: 2, form: FORM, ownWork: { confirmed: true },
    humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-20T10:00:00.000000Z",
  },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

/** The real gate over createApi, against a server that answers `answer()` (a state, a status, or a broken connection). */
export function gateServer(answer: () => unknown) {
  const paths: string[] = [];
  const fetchImpl: NonNullable<ApiOptions["fetchImpl"]> = async (input) => {
    paths.push(new URL(String(input)).pathname);
    const a = answer();
    if (a === "offline") throw new TypeError("offline");
    return typeof a === "number" ? error(a, a === 401 ? "unauthorized" : "unavailable") : json(200, a);
  };
  const call = createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl });
  const read: GateRead = (id) => readDeclarationGate(call, id);
  return { read, paths };
}
