"use client";

import AssistantMatchSection from "../../../teacher/provenance/AssistantMatchSection";
import type { MatchCall } from "../../../teacher/provenance/contract";
import type { OriginRead } from "../../../teacher/provenance/origin";
import { OriginView } from "./OriginView";

/**
 * The composition and the assistant match section (PIL-P1-PODUDARANJE-KARTA; P-1 rule 2.2). The section is drawn
 * after every successful read of the composition, "ready" or "empty", as in the teacher's map (marked or noMarks),
 * so a finding without a share is shown to both alike. Its heading is h2: it stands directly under the page title.
 * The composition list above already names the share, so the section does not repeat it.
 */
export function OriginBody({ read, onRetry, documentId, matchCall }: { read: OriginRead | null; onRetry: () => void; documentId: string; matchCall?: MatchCall }) {
  const readOk = read?.kind === "ready" || read?.kind === "empty";
  return <><OriginView read={read} onRetry={onRetry} />{readOk && <AssistantMatchSection documentId={documentId} call={matchCall} level={2} shareListed />}</>;
}
