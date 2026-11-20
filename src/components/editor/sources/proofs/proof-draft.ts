/**
 * The draft of one proof while the capture dialog is open (E§3.4 proofs). A
 * failed send keeps the draft whole (picture, frame, page, note, quote), so
 * the student sends it again without cutting it again; only a 201 with the
 * proof closes it (B-6).
 */

import {
  noteFits, pageFits, PROOF_NOTE_MAX, PROOF_PAGE_MAX, uploadProof, type ProofDraft, type ProofUpload, type ProofsOptions, type SourceProof,
} from "../../../../client/source-proofs";

import { encodeCut, type Encoder, type ProofPicture, type Rect } from "./crop";
import { judgeQuote, pageText, type QuoteJudgement, type TextRun } from "./quote-match";

export type DraftStatus = "idle" | "sending" | "failed" | "refused" | "expired" | "tooLarge";

export type QuoteNote =
  | QuoteJudgement
  | { readonly kind: "foundOn"; readonly page: number }
  | { readonly kind: "searching" }
  | { readonly kind: "pdfOpening" }
  | { readonly kind: "pdfFailed" }
  | { readonly kind: "readFailed" };

export type PdfView = { readonly page: number; readonly count: number; readonly loading: boolean };

export type Capture = {
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly picture: ProofPicture | null;
  /** The text runs of the shown PDF page; empty for a picture. */
  readonly runs: readonly TextRun[];
  readonly pdf: PdfView | null;
  /** The frame, in the picture's own pixels; null is the whole picture. */
  readonly selection: Rect | null;
  readonly page: string;
  readonly note: string;
  readonly quote: string;
  readonly notice: QuoteNote | null;
  readonly status: DraftStatus;
  /** Set by the first save: from then on the field errors show. */
  readonly tried: boolean;
};

export type CaptureAction =
  | { readonly type: "picture"; readonly picture: ProofPicture; readonly runs?: readonly TextRun[]; readonly pdf?: PdfView | null; readonly selection?: Rect | null }
  | { readonly type: "pdfLoading"; readonly page: number; readonly count: number }
  | { readonly type: "select"; readonly selection: Rect | null }
  | { readonly type: "field"; readonly field: "page" | "note" | "quote"; readonly value: string }
  | { readonly type: "notice"; readonly notice: QuoteNote | null }
  | { readonly type: "tried" }
  | { readonly type: "status"; readonly status: DraftStatus };

export function startCapture(sourceId: string, sourceLabel: string, page = ""): Capture {
  return {
    sourceId, sourceLabel, picture: null, runs: [], pdf: null, selection: null,
    page, note: "", quote: "", notice: null, status: "idle", tried: false,
  };
}

export function captureReducer(state: Capture, action: CaptureAction): Capture {
  switch (action.type) {
    case "picture":
      return {
        ...state, picture: action.picture, runs: action.runs ?? [], pdf: action.pdf ?? null,
        selection: action.selection ?? null, status: state.status === "sending" ? "sending" : "idle",
      };
    case "pdfLoading":
      return { ...state, pdf: { page: action.page, count: action.count, loading: true } };
    case "select":
      return { ...state, selection: action.selection };
    case "field":
      return { ...state, [action.field]: action.value, ...(action.field === "quote" ? { notice: null } : {}) };
    case "notice":
      return { ...state, notice: action.notice };
    case "tried":
      return { ...state, tried: true };
    case "status":
      return { ...state, status: action.status };
  }
}

export type FieldError = "pageRequired" | "pageTooLong" | "noteTooLong";

/** The errors of the fields, shown only once the student tried to save. */
export function fieldErrors(state: Pick<Capture, "page" | "note">): { page?: FieldError; note?: FieldError } {
  const out: { page?: FieldError; note?: FieldError } = {};
  if (!pageFits(state.page)) out.page = state.page.trim() === "" ? "pageRequired" : "pageTooLong";
  if (!noteFits(state.note)) out.note = "noteTooLong";
  return out;
}
export const LIMITS = { page: PROOF_PAGE_MAX, note: PROOF_NOTE_MAX } as const;

/** The quote against the shown PDF page; null for a picture (no text layer). */
export function quoteNotice(state: Pick<Capture, "quote" | "runs" | "pdf">): QuoteJudgement | null {
  if (state.pdf === null || state.quote.trim() === "") return null;
  return judgeQuote(state.quote, pageText(state.runs));
}

export type SaveDeps = {
  readonly assignmentId: string;
  readonly encoder?: Encoder;
  readonly upload?: (assignmentId: string, sourceId: string, draft: ProofDraft, options?: ProofsOptions) => Promise<ProofUpload>;
  readonly options?: ProofsOptions;
};

export type SaveResult = { readonly status: "saved"; readonly proof: SourceProof } | { readonly status: Exclude<DraftStatus, "idle" | "sending"> | "invalid" };

/**
 * Cuts the frame, encodes it and sends only that cut-out with the page and
 * note. Whatever the outcome other than "saved", the caller keeps the draft.
 */
export async function saveCapture(state: Capture, deps: SaveDeps): Promise<SaveResult> {
  const errors = fieldErrors(state);
  if (state.picture === null || errors.page !== undefined || errors.note !== undefined) return { status: "invalid" };
  const image = await encodeCut(state.picture, state.selection, deps.encoder);
  if (image === null) return { status: "tooLarge" };
  const note = state.note.trim();
  const draft: ProofDraft = note === "" ? { image, page: state.page } : { image, page: state.page, note };
  const result = await (deps.upload ?? uploadProof)(deps.assignmentId, state.sourceId, draft, deps.options);
  switch (result.kind) {
    case "ok": return { status: "saved", proof: result.proof };
    case "odbijeno": return { status: "tooLarge" };
    case "session-expired": return { status: "expired" };
    case "greska": return { status: result.code === "too_large" ? "tooLarge" : "refused" };
    case "nepoznato": return { status: "failed" };
  }
  return { status: "failed" };
}
