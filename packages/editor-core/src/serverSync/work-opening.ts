import { EDIT_STEP_FORMAT_V1, EDIT_STEP_FORMAT_V2, EDIT_STEP_FORMAT_V3 } from "../document/document/edit-step";
import {
  REVISION_ZERO_SHA256, REVISION_ZERO_V2_SHA256, REVISION_ZERO_V3_SHA256,
} from "../document/document/revision-zero";
import type { DocumentSchemaVersion, VersionedDocument } from "../document/document/schema";
import { verifyVersionedDocumentSnapshot } from "../document/document/snapshot";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import type { EvidenceStepFormat } from "../document/forensics/evidence-segment-v2";
import { SLIDES_REVISION_ZERO_SHA256, type SlidesDocument } from "../slides/model";
import { verifySlidesSnapshot } from "../slides/json";
import { SLIDE_STEP_FORMAT_V1 } from "../slides/steps";
import type { SheetDocument } from "../sheet/model";
import { SHEET_REVISION_ZERO_SHA256, SHEET_STEP_FORMAT_V1, verifySheetSnapshot } from "../sheet/steps";
import type { EvidenceOpening, EvidenceSegmentTransaction } from "../sync/journal-types";

const schema = {
  1: { zero: REVISION_ZERO_SHA256, format: EDIT_STEP_FORMAT_V1 },
  2: { zero: REVISION_ZERO_V2_SHA256, format: EDIT_STEP_FORMAT_V2 },
  3: { zero: REVISION_ZERO_V3_SHA256, format: EDIT_STEP_FORMAT_V3 },
} as const;

/** Adapted from an authenticated open response, bound to the work it describes. */
export type RevisionZeroProof = Readonly<{ documentId: string; sha256: string }>;

const verified = Symbol("verified work opening");

export type VerifiedWorkOpening = Readonly<{
  [verified]: true;
  documentId: string;
  revision: number;
  snapshotSha256: string;
  schemaVersion: DocumentSchemaVersion;
  transactionFormat: EvidenceStepFormat;
  document: VersionedDocument;
  /**
   * WEB-V13-DNEVNIK-SINKRONIZACIJA: set to "slides" for a slides work and
   * absent for every text work, so a text opening is byte for byte what it was.
   * A slides opening is built only by `verifySlidesWorkOpening`; its `document`
   * is a `SlidesDocument` (read it with `slidesOf`), its `schemaVersion` is the
   * slides line's own 1 and means nothing for the text schemas.
   */
  documentKind?: "slides" | "spreadsheet";
}>;

/**
 * An open answer as `verifyWorkOpening` takes it: the journal's `EvidenceOpening`
 * and, for a slides work, `documentKind: "slides"` as the server states it. (The
 * shared type in sync/journal-types.ts stays as it was: it belongs to another lane.)
 */
export type OpeningInput = EvidenceOpening & Readonly<{ documentKind?: "slides" | "spreadsheet" }>;

/** The slides document of an opening of a slides work, or null for any other opening. */
export function slidesOf(work: VerifiedWorkOpening): SlidesDocument | null {
  return work.documentKind === "slides" ? (work.document as unknown as SlidesDocument) : null;
}

/**
 * WEB-V14-SHEET-JOURNAL: the spreadsheet document of an opening of a spreadsheet
 * work, or null for any other opening. Its `schemaVersion` is the sheet line's own 1.
 */
export function sheetOf(work: VerifiedWorkOpening): SheetDocument | null {
  return work.documentKind === "spreadsheet" ? (work.document as unknown as SheetDocument) : null;
}

/**
 * WEB-V14-SHEET-JOURNAL: the open answer of a spreadsheet work, verified as for
 * slides: the exact JCS of a valid spreadsheet document with `documentHash`;
 * revision 0 is the one constant revision zero with an empty chain.
 */
export async function verifySheetWorkOpening(
  expectedDocumentId: string,
  opened: OpeningInput,
  proof?: RevisionZeroProof,
): Promise<VerifiedWorkOpening | null> {
  const { documentId, currentRevision, documentHash, document, headSegmentHash, lastSequenceTo } = opened;
  if (documentId !== expectedDocumentId || documentId.length === 0 ||
      !Number.isSafeInteger(currentRevision) || currentRevision < 0) return null;
  if (proof !== undefined && (proof.documentId !== documentId || proof.sha256 !== SHEET_REVISION_ZERO_SHA256)) return null;
  const snapshot = await verifySheetSnapshot(document);
  if (!snapshot.ok || snapshot.sha256 !== documentHash) return null;
  if (currentRevision === 0 &&
      (snapshot.sha256 !== SHEET_REVISION_ZERO_SHA256 || lastSequenceTo !== 0 || headSegmentHash !== null)) return null;
  return Object.freeze({
    [verified]: true as const, documentId, revision: currentRevision, snapshotSha256: snapshot.sha256,
    schemaVersion: 1 as const, transactionFormat: SHEET_STEP_FORMAT_V1,
    document: snapshot.document as unknown as VersionedDocument, documentKind: "spreadsheet" as const,
  });
}

/**
 * The open answer of a slides work, verified (contract slides-v1 §7): its
 * snapshot is the exact JCS of a valid slides document with `documentHash`,
 * revision 0 is the fixed revision zero of every slides work with an empty
 * chain, and a later revision is a valid slides document. The revision zero of
 * slides is one constant for all works, so no per-work proof is needed; a
 * `proof` that is given must still be that constant for this work.
 */
export async function verifySlidesWorkOpening(
  expectedDocumentId: string,
  opened: OpeningInput,
  proof?: RevisionZeroProof,
): Promise<VerifiedWorkOpening | null> {
  const { documentId, currentRevision, documentHash, document, headSegmentHash, lastSequenceTo } = opened;
  if (documentId !== expectedDocumentId || documentId.length === 0 ||
      !Number.isSafeInteger(currentRevision) || currentRevision < 0) return null;
  if (proof !== undefined && (proof.documentId !== documentId || proof.sha256 !== SLIDES_REVISION_ZERO_SHA256)) return null;
  const snapshot = await verifySlidesSnapshot(document);
  if (!snapshot.ok || snapshot.sha256 !== documentHash) return null;
  if (currentRevision === 0 &&
      (snapshot.sha256 !== SLIDES_REVISION_ZERO_SHA256 || lastSequenceTo !== 0 || headSegmentHash !== null)) return null;
  return Object.freeze({
    [verified]: true as const, documentId, revision: currentRevision, snapshotSha256: snapshot.sha256,
    schemaVersion: 1 as const, transactionFormat: SLIDE_STEP_FORMAT_V1,
    document: snapshot.document as unknown as VersionedDocument, documentKind: "slides" as const,
  });
}

/**
 * A revision zero snapshot is itself proof. For a later v3 revision the caller
 * must supply the server's revision zero hash for this same work. Legacy v1/v2
 * responses can still identify their own snapshot version without that field.
 */
export async function verifyWorkOpening(
  expectedDocumentId: string,
  opened: OpeningInput,
  proof?: RevisionZeroProof,
): Promise<VerifiedWorkOpening | null> {
  if (opened.documentKind === "slides") return verifySlidesWorkOpening(expectedDocumentId, opened, proof);
  if (opened.documentKind === "spreadsheet") return verifySheetWorkOpening(expectedDocumentId, opened, proof);
  const { documentId, currentRevision, documentHash, document, headSegmentHash, lastSequenceTo } = opened;
  if (documentId !== expectedDocumentId || documentId.length === 0 ||
      !Number.isSafeInteger(currentRevision) || currentRevision < 0) return null;
  const snapshot = await verifyVersionedDocumentSnapshot(document);
  if (!snapshot.ok || snapshot.sha256 !== documentHash) return null;

  const schemaVersion = snapshot.document.schemaVersion;
  const { zero, format } = schema[schemaVersion];
  if (proof !== undefined && (proof.documentId !== documentId || proof.sha256 !== zero)) return null;
  if (currentRevision === 0) {
    if (snapshot.sha256 !== zero || lastSequenceTo !== 0 || headSegmentHash !== null) return null;
  } else if (schemaVersion === 3 && proof === undefined) return null;

  return Object.freeze({
    [verified]: true as const, documentId, revision: currentRevision, snapshotSha256: snapshot.sha256,
    schemaVersion, transactionFormat: format, document: snapshot.document,
  });
}

/** Checks the exact bytes of a queued write against this work before sending. */
export async function matchesWorkOpening(
  opening: VerifiedWorkOpening,
  documentId: string,
  tx: Pick<EvidenceSegmentTransaction, "document" | "segment" | "segmentHash">,
): Promise<boolean> {
  if (!matchesWorkSchema(opening, documentId, opening.schemaVersion)) return false;
  if (opening.documentKind === "slides") {
    const [slideSegment, slideSnapshot] = await Promise.all([
      verifyCanonicalEvidencePayloadV2(tx.segment, SLIDE_STEP_FORMAT_V1),
      verifySlidesSnapshot(tx.document),
    ]);
    return slideSegment.ok && slideSnapshot.ok && slideSegment.sha256 === tx.segmentHash &&
      slideSegment.segment.documentId === documentId &&
      slideSegment.segment.finalDocumentHash === slideSnapshot.sha256;
  }
  if (opening.documentKind === "spreadsheet") {
    const [sheetSegment, sheetSnapshot] = await Promise.all([
      verifyCanonicalEvidencePayloadV2(tx.segment, SHEET_STEP_FORMAT_V1),
      verifySheetSnapshot(tx.document),
    ]);
    return sheetSegment.ok && sheetSnapshot.ok && sheetSegment.sha256 === tx.segmentHash &&
      sheetSegment.segment.documentId === documentId &&
      sheetSegment.segment.finalDocumentHash === sheetSnapshot.sha256;
  }
  const [segment, snapshot] = await Promise.all([
    verifyCanonicalEvidencePayloadV2(tx.segment, opening.transactionFormat),
    verifyVersionedDocumentSnapshot(tx.document),
  ]);
  return segment.ok && snapshot.ok && segment.sha256 === tx.segmentHash &&
    segment.segment.documentId === documentId && snapshot.document.schemaVersion === opening.schemaVersion &&
    segment.segment.finalDocumentHash === snapshot.sha256;
}

export function matchesWorkSchema(
  work: VerifiedWorkOpening,
  documentId: string,
  schemaVersion: DocumentSchemaVersion,
): boolean {
  return work[verified] === true && work.documentId === documentId && work.schemaVersion === schemaVersion;
}
