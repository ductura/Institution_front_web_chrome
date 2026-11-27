/**
 * The entry-method share of a submission (WEB-1220), the one home of this
 * block: the student's step 5 and the teacher's N-07 render it unchanged, so
 * both see the same record in the same words. It takes no role, no threshold
 * and no sort order, and offers no action on the record.
 */

import { ProvenanceShare, type ProvenanceShareLabels } from "@ductura/ui";

import type { ProvenancePort, ProvenanceRead } from "../../client/provenance";
import { provenanceShareHr } from "../../lib/i18n/messages.hr";

const LABELS: ProvenanceShareLabels = provenanceShareHr;

/** A port that fails reads as the error variant, never as an empty record. */
export async function readProvenance(port: ProvenancePort, submissionId: string): Promise<ProvenanceRead> {
  return port.read(submissionId).catch((): ProvenanceRead => ({ kind: "error" }));
}

/**
 * `onRetry` shows the „Pokušaj ponovno” link under a failed read; without it the failure stays a
 * bare role=alert frame (the student's step 5). `showMatch` is the faculty switch of the match
 * mark (D-268 O6, off in the pilot): when it is off the record carries no mark, whatever the read
 * holds. The default keeps the student's screen as it was.
 */
export function ProvenancePanel({ read, onRetry, showMatch = true }: {
  readonly read: ProvenanceRead;
  readonly onRetry?: () => void;
  readonly showMatch?: boolean;
}) {
  const state: ProvenanceRead = read.kind === "ready" && !showMatch ? { ...read, aiMatch: undefined } : read;
  return <ProvenanceShare labels={LABELS} state={state} onRetry={onRetry} />;
}
