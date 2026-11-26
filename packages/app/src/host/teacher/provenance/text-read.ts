// PG-2 (WEB-NF5-KARTA): the marked text of one work. Two reads from the contract extract, through createApi, which
// also holds each answer to the generated schema:
//   work.origin-segments.get { documentId }            -> 200 { revision, segments: [{ blockId, start, end, kind, segmentRef }] }
//   work.version.get         { documentId, revision }  -> 200 { revision, document } (the revision of those ranges)
// The ranges are read first, so the text shown is always the revision they belong to. The student and every reader
// of the work get the same answer (origin-segments-v1); nothing is written.
import { createApi, type ApiOptions } from "@/client/api";

import { placeRanges, textBlocksOfDocument, type MarkedText } from "./marked-text";

export type TextRead =
  | { readonly kind: "text"; readonly text: MarkedText }
  | { readonly kind: "noRanges" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type TextState = TextRead | { readonly kind: "loading" };

export type TextCall = (documentId: string) => Promise<TextRead>;

const failed = (status: number): TextRead =>
  status === 401 ? { kind: "signedOut" } : status === 404 ? { kind: "notFound" } : { kind: "unavailable" };

export function markedTextReader(options?: ApiOptions): TextCall {
  return async (documentId) => {
    if (documentId.length === 0) return { kind: "notFound" };
    const call = createApi(options);
    try {
      const ranges = await call("work.origin-segments.get", { params: { documentId }, query: {}, body: undefined });
      if (!ranges.ok) return failed(ranges.status);
      const { revision, segments } = ranges.body;
      if (revision === null || revision < 1 || segments.length === 0) return { kind: "noRanges" };
      const version = await call("work.version.get", { params: { documentId, revision: String(revision) }, query: {}, body: undefined });
      if (!version.ok) return failed(version.status);
      if (!("document" in version.body) || version.body.revision !== revision) return { kind: "unavailable" };
      const blocks = textBlocksOfDocument(JSON.parse(version.body.document));
      if (blocks === null) return { kind: "unavailable" };
      return { kind: "text", text: placeRanges(revision, blocks, segments) };
    } catch {
      return { kind: "unavailable" };
    }
  };
}

export const readMarkedText: TextCall = (documentId) => markedTextReader()(documentId);
