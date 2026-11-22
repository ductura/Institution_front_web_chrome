import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import type { OriginComposition, OriginKind, OriginSegment, OriginShare } from "./contract";
import { ORIGIN_KINDS } from "./contract";
import { originText as t } from "./messages.hr";

const LABELS: Record<OriginKind, string> = {
  typed: t.kindTyped,
  assistant_inserted: t.kindAssistantInserted,
  assistant_match: t.kindAssistantMatch,
  imported_file: t.kindImportedFile,
  pasted_known: t.kindPastedKnown,
  pasted_unknown: t.kindPastedUnknown,
};

export const kindLabel = (kind: OriginKind): string => LABELS[kind];

export const percentText = (share: Pick<OriginShare, "percent" | "codePoints">): string =>
  share.percent === 0 && share.codePoints > 0 ? t.lessThanOne : `${share.percent} %`;

/** "Tipkano u Ducturi · 62 %"; fixed order of the closed list, never sorted by size, no colour per level. */
export function shareRows(c: OriginComposition): readonly { kind: OriginKind; label: string; value: string }[] {
  return ORIGIN_KINDS.flatMap((kind) => {
    const share = c.shares.find((s) => s.kind === kind);
    return share === undefined || share.codePoints === 0 ? [] : [{ kind, label: `${kindLabel(kind)} · ${percentText(share)}`, value: percentText(share) }];
  });
}

/** The line „N % nepoznato podrijetlo”, only when there is such text. */
export function unknownLine(c: OriginComposition): string | null {
  const share = c.shares.find((s) => s.kind === "pasted_unknown");
  return share === undefined || share.codePoints === 0 ? null : `${percentText(share)} ${t.unknownShare}`;
}

/** The rhythm cell of a segment: the gaps as the server gave them, nothing derived. Null when the rhythm is off. */
export function rhythmCell(c: OriginComposition, segment: OriginSegment): string | null {
  if (!c.rhythmRecorded) return null;
  return segment.gapsMs === undefined || segment.gapsMs.length === 0 ? t.rhythmNone : segment.gapsMs.join(" ");
}

export const segmentTime = (segment: OriginSegment): string => formatDateTimeHr(segment.at);
