// "Podrijetlo teksta" of the student (PIL-P1-SASTAV-STUDENT; P-1 rule 2.2): the student and the teacher see the same
// composition. The server answer of work.origin-composition.get is one percent per kind; it is turned into the same
// OriginComposition the teacher's screen (WEB-0911) renders, so one model and one set of captions serve both.
import type { OriginComposition, OriginKind, OriginRead } from "../../../teacher/provenance/origin";
import { ORIGIN_KINDS } from "../../../teacher/provenance/origin";

export type OriginPart = { readonly kind: string; readonly percent: number };

/** Hundredths of a percent stand in for code points: the answer has no counts, only shares. */
const SCALE = 100;

/** The composition of the answer; the answer is empty when no kind has any share. No segments and no rhythm. */
export function readOfParts(parts: readonly OriginPart[]): OriginRead {
  const known = parts.filter((p): p is { kind: OriginKind; percent: number } => (ORIGIN_KINDS as readonly string[]).includes(p.kind));
  const shares = ORIGIN_KINDS.map((kind) => {
    const percent = known.find((p) => p.kind === kind)?.percent ?? 0;
    return { kind, codePoints: Math.round(percent * SCALE), percent: Math.round(percent) };
  });
  const totalCodePoints = shares.reduce((sum, s) => sum + s.codePoints, 0);
  if (totalCodePoints === 0) return { kind: "empty" };
  const composition: OriginComposition = { totalCodePoints, shares, segments: [], rhythmRecorded: false };
  return { kind: "ready", composition };
}
