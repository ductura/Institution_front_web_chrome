// PG-14 (WEB-NUZ-PG): the forbidden-terms scan of the work review texts. „dokaz autorstva” is allowed only in the
// negation the order and Ustav v1.6 C-6 ask for next to every share („nije dokaz autorstva”); any other reading
// of it, and every other term of PRODUCT §5, is still found. The scanner itself (scripts/forbidden-terms) is not
// changed: the negation is masked before the text goes to it.
import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";

const NEGATION = /(?<![\p{L}\p{N}])nije dokaz autorstva(?![\p{L}\p{N}])/giu;

/** The forbidden terms of a Croatian interface text, with „nije dokaz autorstva” allowed. */
export const forbiddenInReview = (text: string): readonly string[] =>
  findForbiddenTerms(text.replace(NEGATION, "nije ·"), "hr").map((finding) => finding.entry);

/** Words the work review never uses, also where §5 has no entry: no verdict, no provider, no model (Q-10). */
export const NEVER = /plagij|varanj|varal|sumnj|provjer\p{L}* ai|detekc|prepis|kazn|pružatelj|model [a-z0-9]/iu;
