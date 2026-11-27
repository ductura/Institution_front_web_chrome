// PR-19 (NF-3): the VIZ "puno" student walks the whole submission of T1 on the fake server:
// a confirmed declaration for the text evidence.open gives, a submission whose signed
// receipt names the document and revision the page sent, the 409 outcomes, the withdrawal
// and the history, so E-8 to E-11 can be clicked and shot. One state per fake server, so
// a page that submits sees its receipt on the next read. Pure, no network.
// Invented people, documents and receipts only; the signature is the contract vector's
// placeholder (the browser does not check it, P-4).

/** What submission.submit-second.post answers in this run (default: the work is submitted). */
export const ISHODI_PREDAJE = ["predano", "nije-otvoreno", "odbijeno", "vec-zatrazeno", "izjava", "nepoznato"] as const;
export type IshodPredaje = (typeof ISHODI_PREDAJE)[number];

export type Odgovor = { readonly status: number; readonly body: unknown };
type Vector = { route: string; name: string; response?: { status: number; body?: unknown } };

/** The document and revision of the contract vector evidence.open.post "opened-after-commit". */
export const DOKUMENT_T1 = "dokument-izmisljeni-zv-1";
export const REVIZIJA_T1 = 1;
const STUDENT = "00000000-0000-4000-8000-0000000000e1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
/** The receipt's time shape: microseconds and Z. */
const mikro = (iso: string) => new Date(iso).toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The body of the named success vector of a route (the shape is the contract's own). */
function vektor(vectors: readonly Vector[], route: string, name: string): Record<string, unknown> {
  const body = vectors.find((v) => v.route === route && v.name === name)?.response?.body;
  if (!isObject(body)) throw new Error(`VIZ: vektor ${route}/${name} ne postoji`);
  return structuredClone(body);
}

export function predaja(vectors: readonly Vector[], t1: { id: string; dueAt: string }, ishod: IshodPredaje, sada: string) {
  const potvrda = vektor(vectors, "submission.submit-second.post", "submitted").receipt as Record<string, any>;
  const povlacenje = vektor(vectors, "student.submission-withdrawal.post", "withdrawn").receipt as Record<string, any>;
  const state = {
    receipt: null as Record<string, any> | null,
    /** 409 already_requested: the revision the server holds, not signed yet. */
    ceka: null as number | null,
    events: [] as Record<string, unknown>[],
    withdrawals: [] as Record<string, unknown>[],
    attempt: 0,
  };

  const declaration = () => ({
    state: state.receipt === null ? "confirmed" : "bound", submitted: state.receipt !== null,
    currentRevision: REVIZIJA_T1, version: 2, formText: "Izmišljeni obrazac izjave fakulteta.",
    currentForm: { ...FORM, text: "Izmišljeni obrazac izjave fakulteta." }, draft: null, declarationSha256: "d".repeat(64),
    uploads: [], declarationRequired: true, teacherQuestion: null, questionAnswer: null,
    payload: {
      declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 2,
      principalId: STUDENT, assignmentId: t1.id, assignmentVersion: 1, documentId: DOKUMENT_T1, revision: REVIZIJA_T1,
      form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
      ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] }, confirmedAt: mikro("2026-11-04T10:00:00Z"),
    },
  });

  function submit(body: unknown): Odgovor {
    const sent = isObject(body) ? body : {};
    const revision = typeof sent.revision === "number" ? sent.revision : REVIZIJA_T1;
    if (state.receipt !== null) return { status: 409, body: { status: "already_requested", revision: state.receipt.payload.revision } };
    switch (ishod) {
      case "nije-otvoreno": return { status: 409, body: { status: "not_open" } };
      case "odbijeno": return { status: 409, body: { status: "blocked", reason: "no_evidence" } };
      case "izjava": return { status: 409, body: { status: "declaration_required" } };
      case "nepoznato": return { status: 503, body: { status: "unavailable", stage: "signing" } };
      case "vec-zatrazeno": state.ceka = revision; return { status: 409, body: { status: "already_requested", revision } };
      case "predano": break;
    }
    state.attempt += 1;
    const submissionId = `5b0c3e2a-7d14-4f6b-9a8e-1c2d3e4f5a0${state.attempt}`;
    const receipt = structuredClone(potvrda);
    Object.assign(receipt.payload, {
      submissionId, principalId: STUDENT, assignmentId: t1.id, assignmentVersion: 1,
      documentId: typeof sent.documentId === "string" ? sent.documentId : DOKUMENT_T1, revision,
      requestedAt: mikro(sada), dueAt: mikro(t1.dueAt), afterDeadline: new Date(sada) > new Date(t1.dueAt), signedAt: mikro(sada),
    });
    state.receipt = receipt;
    state.events.push({ kind: "submission", id: submissionId, attempt: state.attempt, submissionId, revision,
      at: new Date(sada).toISOString(), afterDeadline: receipt.payload.afterDeadline, receipt });
    return { status: 200, body: { status: "submitted", receipt } };
  }

  function withdraw(): Odgovor {
    const submitted = state.receipt;
    if (submitted === null) return { status: 409, body: { error: "not_started", code: "not_started", messageKey: "errors.notStarted", status: 409, requestId: "00000000-0000-4000-8000-00000019030d" } };
    const receipt = structuredClone(povlacenje);
    const withdrawalId = `6c1d4f3b-8e25-4a7c-8b9f-2d3e4f5a6b0${state.attempt}`;
    Object.assign(receipt.payload, {
      withdrawalId, submissionId: submitted.payload.submissionId, principalId: STUDENT, assignmentId: t1.id,
      withdrawnAt: mikro(sada), dueAt: mikro(t1.dueAt), signedAt: mikro(sada),
    });
    state.receipt = null;
    state.withdrawals.push({ withdrawalId, assignmentId: t1.id, revision: submitted.payload.revision, withdrawnAt: receipt.payload.withdrawnAt, signature: receipt.signature.signatureBase64Url });
    state.events.push({ kind: "withdrawal", id: withdrawalId, attempt: state.attempt, submissionId: submitted.payload.submissionId,
      revision: submitted.payload.revision, at: new Date(sada).toISOString(), receipt });
    return { status: 200, body: { status: "withdrawn", receipt } };
  }

  /** The answer for T1's submission, or undefined when this operation or assignment is not T1's. */
  return function answer(operation: string, assignmentId: string | undefined, body: unknown): Odgovor | undefined {
    if (operation === "submission.submit-second.post") return submit(body);
    if (operation === "student.submission-withdrawal.post") return assignmentId === t1.id ? withdraw() : undefined;
    if (operation === "evidence.open.post") {
      const opened = vektor(vectors, "evidence.open.post", "opened-after-commit");
      return isObject(body) && body.assignmentId === t1.id ? { status: 200, body: { ...opened, submitted: state.receipt !== null } } : undefined;
    }
    if (assignmentId !== t1.id) return undefined;
    switch (operation) {
      case "student.declaration.get": return { status: 200, body: declaration() };
      // The step reads declaration-v2 (the extract has it); the confirmed declaration is the same text.
      case "student.declaration-second.get": return { status: 200, body: declaration() };
      case "student.submission.get":
        if (state.receipt !== null) return { status: 200, body: { state: "potvrdeno", receipt: state.receipt } };
        return { status: 200, body: state.ceka === null ? { state: "none" } : { state: "ceka", revision: state.ceka, requestedAt: mikro(sada) } };
      case "student.submission-withdrawal.get":
        return { status: 200, body: { withdrawable: state.receipt !== null, receipts: state.withdrawals } };
      case "student.submission-history.get":
        return { status: 200, body: { withdrawalAllowed: true, dueAt: new Date(t1.dueAt).toISOString(), events: state.events } };
      default: return undefined;
    }
  };
}
