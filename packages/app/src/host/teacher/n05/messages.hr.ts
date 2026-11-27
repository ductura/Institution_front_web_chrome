// N-05 "Brz put" in the host (WEB-2142): the texts of the prototype cards where they differ from
// the component's (paritet-nast N-05). The rest comes from locales/hr.ts `fastPath`.
export const fastPathHostText = {
  title: "Brz put",
  lead: "Radovi jednog zadatka, jedan za drugim. Prikaz samo čita; ništa ne mijenja.",
  loading: "Učitavanje radova…",
  unavailable: "Radovi trenutačno nisu dostupni. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  // NZ-1: the chooser of the assignment (prototype `brz-put`, izbornik „Zadatak”).
  task: "Zadatak",
  open: "Otvori",
  tasksLoading: "Učitavanje zadataka…",
  emptyTitle: "Nema radova",
  emptyText: "Nijedan student još nije započeo rad u ovom zadatku.",
  previous: "Prethodni",
  next: "Sljedeći",
  notStarted: "Rad još nije započet, pa nema teksta ni sažetka.",
  work: {
    notice_pending: "Obavijest nije potvrđena",
    writing: "U pisanju",
    submitted: "Predano",
  },
  lines: {
    state: "Stanje",
    lastChange: "Zadnja promjena",
    pastes: "Lijepljenja bez izvora",
  },
  pastesSome: "Ima ih, popis u punom sažetku",
  pastesNone: "Nema ih",
} as const;
