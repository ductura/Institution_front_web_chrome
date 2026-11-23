/** PIL-P1-RITAM-NASTAVNIK: the teacher's rhythm switch on the course and on one assignment. */
export const rhythmSwitchHr = {
  label: "Bilježi ritam tipkanja",
  labelFor: (name: string): string => `Bilježi ritam tipkanja: ${name}`,
  course: {
    course: "Postavka predmeta. Vrijedi za sve zadatke koji nemaju vlastitu postavku.",
    default: "Zadana postavka. Predmet još nema vlastitu postavku.",
    assignment: "Postavka predmeta.",
  },
  assignment: {
    assignment: "Postavka ovog zadatka. Nadjačava postavku predmeta.",
    course: "Prema postavci predmeta.",
    default: "Prema zadanoj postavci.",
  },
  reset: "Vrati na postavku predmeta",
  resetFor: (name: string): string => `Vrati na postavku predmeta: ${name}`,
  loading: "Učitavam postavku ritma…",
  saving: "Spremam…",
  saved: "Spremljeno na poslužitelju.",
  notSaved: "Poslužitelj nije potvrdio promjenu. Vrijedi postavka prikazana gore.",
  unavailable: "Postavka ritma trenutačno nije dostupna.",
  retry: "Pokušaj ponovno",
} as const;
