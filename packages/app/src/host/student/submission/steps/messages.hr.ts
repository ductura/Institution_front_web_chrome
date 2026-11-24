// WEB-2106: the shell of submission steps 2 and 3 (E-8, E-9), the texts as the
// student prototype and INVENTAR-student give them.
export const stepsText = {
  pathSeparator: " · ",
  intro: "Popis pokazuje je li sve priloženo. Ne ocjenjuje rad.",
  loadingWork: "Učitavam stanje rada s poslužitelja.",
  loadingRecorded: "Učitavam zabilježene stavke i priloge.",
  notStarted: "Rad još nije započet. Započnite ga u radnom prostoru.",
  openWorkspace: "Otvori radni prostor",
  alreadyRequested: "Predaja ovog rada već je zatražena.",
  alreadyRequestedAt: "Predaja ovog rada već je zatražena {when}.",
  panelTitle: "Predaja",
  declarationTitle: "Izjava",
  beforeSubmitTitle: "Prije predaje",
  panelLabel: "Predaja",
  openReceipt: "Otvori potvrdu o predaji",
  declarationSubmitted: "Izjava je predana s radom i više se ne mijenja.",
  workError: "Stanje rada trenutačno nije moguće učitati, pa se ne vidi je li rad predan. Ako je predaja zabilježena, ovdje će stajati potvrda.",
  retry: "Pokušaj ponovno",
} as const;
