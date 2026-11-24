// P-11 (NF-1, E-5b): the one rule for an enrolment code, on the home page's code
// card (R-10), in ?kod and in the E-5 field. It is the rule enroll() applies
// before sending (src/components/student/upis/enroll.ts, normalizeCode): no
// spaces or hyphens, capitals. The field shows the code as it will be sent.

/** The longest code the text "8 do 32 slova i brojke" allows; the fields' maxLength. */
export const CODE_MAX = 32;

/** The longest raw value the contract's body takes (student.enrollments.post `code`). */
export const CODE_RAW_MAX = 64;

/** The code without spaces or hyphens, in capitals; empty stays empty. */
export function cleanCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
