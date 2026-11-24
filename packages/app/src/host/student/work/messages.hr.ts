// WEB-2105: the text of the workspace pages outside the editor (E-7 frame, /rad).
export const workText = {
  indexTitle: "Radni prostor",
  indexIntro: "Radovi koje ste započeli.",
  inProgress: "Radovi u tijeku",
  open: "Otvori rad",
  openFor: "Otvori rad: {title}",
  none: "Nemate rad u tijeku. Rad započnite na kartici zadatka.",
  toTasks: "Moji zadaci",
  due: "Rok",
  unavailable: "Prikaz trenutačno nije dostupan.",
  retry: "Pokušaj ponovno",
  /** E-7 `prazno`: the footer of a work not started yet. */
  newWork: "Novi rad, još ništa nije upisano",
  placeholder: "Počnite pisati…",
  /** E-7 `ucitavanje`, `greska`, `bez-mreze` and `predano`: the canvas notes and the bar's words. */
  loading: "Učitavanje…",
  // ED-01b: the alert of `greska` is the shared sentence of the cause (src/components/editor/open-failure.ts).
  errorStatus: "Greška pri otvaranju",
  offlineLead: "Bez mreže.",
  offlineBody: "Tekst se i dalje sprema na ovom uređaju i čeka slanje na poslužitelj kad se veza vrati.",
  offlineNet: "Bez mreže",
  submittedLead: "Predano {at}.",
  submittedBody: "Rad je predan, pa se ovdje više ne može pisati.",
  submittedStatus: "Predano {at}",
  courseLine: "{course} · rok {due}",
  notStarted: "Rad još nije započet. Započnite ga da biste mogli pisati.",
} as const;
