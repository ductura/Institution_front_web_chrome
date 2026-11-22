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
  notStarted: "Rad još nije započet. Započnite ga da biste mogli pisati.",
} as const;
