// ED-80 (prototype assist2.js `PII`, `AX.preSend`): before a question goes to the Asistent, the
// text is searched for an e-mail address, an OIB or other 11-digit number and a phone number.
// The provider does not need them; the student may remove them, send anyway or go back.
export type PersonalDataKind = "email" | "longNumber" | "phone";

export type PersonalDataFinding = { readonly kind: PersonalDataKind; readonly matches: readonly string[] };

const PATTERNS: readonly (readonly [PersonalDataKind, RegExp])[] = [
  ["email", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["longNumber", /\b\d{11}\b/g],
  ["phone", /(?:\+385|\b0)\s?\d{1,2}[\s/-]?\d{3}[\s-]?\d{3,4}\b/g],
];

/** What the prototype writes where a finding was. */
export const REMOVED = "[uklonjeno]";

/** Each kind found in the text, with its matches in order; kinds with none are left out. */
export function findPersonalData(text: string): readonly PersonalDataFinding[] {
  const found: PersonalDataFinding[] = [];
  for (const [kind, pattern] of PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    if (matches !== null && matches.length > 0) found.push({ kind, matches });
  }
  return found;
}

/** The text with every finding replaced by REMOVED, in the prototype's order (e-mail first). */
export function removePersonalData(text: string): string {
  return PATTERNS.reduce((rest, [, pattern]) => rest.replace(new RegExp(pattern.source, pattern.flags), REMOVED), text);
}
