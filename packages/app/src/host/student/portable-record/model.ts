import type { PortableRecordLabels, PortableRecordState } from "@ductura/ui";

import { downloadPortableRecord, type PortableRecordOptions, type PortableRecordResult } from "../../../../../../src/client/portable-record";
import { portableRecordText as text } from "./messages.hr";

export const portableRecordLabels: PortableRecordLabels = {
  title: text.title,
  contentsLead: text.contentsLead,
  contents: text.contents,
  howToLead: text.howToLead,
  howTo: text.howTo,
  download: text.download,
  downloading: text.downloading,
};

/** What the card shows after the answer; a 404 says the catalogue's message, never why. */
export function stateOf(result: PortableRecordResult): PortableRecordState | "signedOut" {
  switch (result.kind) {
    case "ready": return { kind: "ready" };
    case "signedOut": return "signedOut";
    case "notFound": return { kind: "error", message: text.notFound };
    default: return { kind: "error", message: text.unavailable };
  }
}

/** One download, start to end: the file for the browser to save, or the state to show. */
export async function fetchRecord(
  submissionId: string, options?: PortableRecordOptions,
): Promise<{ readonly state: PortableRecordState | "signedOut"; readonly file: Extract<PortableRecordResult, { kind: "ready" }> | null }> {
  const result = await downloadPortableRecord(submissionId, options);
  return { state: stateOf(result), file: result.kind === "ready" ? result : null };
}
