// ED-130: the teacher's text checks with "U komentar" (prototype review2.js, TOCM).
export const textChecksHr = {
  title: "Provjere teksta",
  note: "Iste provjere koje student vidi u svom pregledu. Nalaz možete pretvoriti u komentar na tim riječima.",
  list: "Nalazi provjere teksta",
  empty: "Provjere u ovom tekstu nisu našle ništa što bi trebalo komentirati.",
  required: "Obavezno",
  advisory: "Savjet",
  toComment: "U komentar",
  done: "Napomena je u novom komentaru. Tekst možete urediti prije objave.",
  noAnchor: "Riječi ovog nalaza više nisu u tekstu. Označite ih ručno.",
  waiting: "Komentari se još učitavaju.",
  /** The first line of the comment, by check (prototype TOCM; "num" is the prototype's "claim"). */
  comment: {
    num: "Tvrdnja traži izvor. Odakle je ovaj podatak?",
    long: "Rečenica je preduga; podijelite je na dvije.",
    colloq: "Razgovorni izraz; zamijenite ga neutralnim.",
    absolute: "Preoštra tvrdnja; ublažite je ili potkrijepite.",
    first: "Upute traže treće lice.",
    passive: "Previše pasiva zaredom.",
  },
} as const;
