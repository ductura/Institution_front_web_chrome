// ED-79: "Popis kratica" on the sheet and its dialog (prototype more2.js `abPaint`, `m2AbEdit`).
// The prototype's "Ide u Word ispred literature." is left out: the export does not carry the list yet.
export const abbreviationsHr = {
  title: "Popis kratica",
  label: "Popis kratica na listu",
  unknown: "puni naziv nije prepoznat",
  edit: "Uredi",
  write: "Upiši",
  editLabel: (abbreviation: string) => `Uredi puni naziv kratice ${abbreviation}`,
  writeLabel: (abbreviation: string) => `Upiši puni naziv kratice ${abbreviation}`,
  empty: "U radu još nema kratica. Popis se slaže sam kad kraticu prvi put napišete uz puni naziv, na primjer: Europska unija (EU).",
  note: "Složeno iz teksta rada.",
  dialogTitle: (abbreviation: string) => `Kratica ${abbreviation}`,
  fullName: "Puni naziv",
  placeholder: "npr. Europska unija",
  hint: "Prazno polje vraća naziv prepoznat iz teksta.",
  save: "Spremi",
  cancel: "Odustani",
} as const;
