import { EDIT_STEP_FORMAT_V1, EDIT_STEP_FORMAT_V2, EDIT_STEP_FORMAT_V3 } from "../document/document/edit-step";
import {
  REVISION_ZERO_SHA256, REVISION_ZERO_V2_SHA256, REVISION_ZERO_V3_SHA256,
} from "../document/document/revision-zero";
import type { DocumentSchemaVersion, VersionedDocument } from "../document/document/schema";
import { verifyVersionedDocumentSnapshot } from "../document/document/snapshot";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import type { EvidenceStepFormat } from "../document/forensics/evidence-segment-v2";
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
}>;

/**
 * A revision zero snapshot is itself proof. For a later v3 revision the caller
 * must supply the server's revision zero hash for this same work. Legacy v1/v2
 * responses can still identify their own snapshot version without that field.
 */
export async function verifyWorkOpening(
  expectedDocumentId: string,
  opened: EvidenceOpening,
  proof?: RevisionZeroProof,
): Promise<VerifiedWorkOpening | null> {
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
