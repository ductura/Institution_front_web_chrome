/**
 * What the proofs panel needs from outside: the three routes and the PDF
 * reader. `liveDeps` wires them to src/client/source-proofs.ts and to pdf.js,
 * which loads only when the student opens a PDF. The catalogue and the tests
 * pass their own, with invented data.
 */

import {
  listProofs, readProofImage, uploadProof, type ProofDraft, type ProofUpload, type ProofsRead, type SourceProof,
} from "../../../../client/source-proofs";

import { pictureOf, type ProofPicture } from "./crop";
import type { PdfPages } from "./pdf-pages";

export type ProofsDeps = {
  readonly assignmentId: string;
  readonly list: (sourceId: string) => Promise<ProofsRead>;
  readonly upload: (sourceId: string, draft: ProofDraft) => Promise<ProofUpload>;
  /** The decoded JPEG of a proof; null when it cannot be read. */
  readonly picture: (proof: SourceProof) => Promise<ProofPicture | null>;
  readonly openPdf: (bytes: ArrayBuffer) => Promise<PdfPages>;
};

export function liveDeps(assignmentId: string): ProofsDeps {
  return {
    assignmentId,
    list: (sourceId) => listProofs(assignmentId, sourceId),
    upload: (sourceId, draft) => uploadProof(assignmentId, sourceId, draft),
    picture: async (proof) => {
      const read = await readProofImage(proof, assignmentId, proof.sourceId);
      if (read.kind !== "ok") return null;
      try {
        return pictureOf(await createImageBitmap(read.image));
      } catch {
        return null;
      }
    },
    openPdf: async (bytes) => (await import("./pdf-pages")).openPdf(bytes),
  };
}
