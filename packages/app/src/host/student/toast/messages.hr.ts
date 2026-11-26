// WEB-2112 (PD-7): the text of the student's toasts, as in the prototype and INVENTAR.
export const studentToastText = {
  region: "Obavijesti",
  close: "Zatvori",
  enrolled: "Upisani ste u kolegij.",
} as const;

/** P-B1: the toast after enrolment names the course; without a name it keeps the plain sentence. */
export function enrolledToast(courseName?: string): string {
  const name = courseName?.trim();
  return name ? `Upisani ste u kolegij ${name}.` : studentToastText.enrolled;
}
