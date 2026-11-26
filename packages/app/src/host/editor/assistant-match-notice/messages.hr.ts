// The student's notice about an assistant match (WEB-1230; D-41; D-58), as in the prototype (nf2.js, NF2-P13).
// It never says "prepisano" and is never a verdict.
import { pluralHr } from "@/lib/i18n/hr";

export const noticeText = {
  title: "Dio teksta podudara se s odgovorom pomoćnika",
  neutral: "Ovo je obična usporedba teksta i ništa ne govori o autorstvu.",
  explainOpen: "Objasni, ako želiš…",
  dialogTitle: "Objasni, ako želiš",
  dialogBody: "Napiši kako je taj dio nastao. Nije obvezno, ne blokira predaju i ne ulazi u ocjenu. Isto vidi i nastavnik.",
  field: "Objašnjenje",
  close: "Zatvori",
  send: "Pošalji objašnjenje",
  sending: "Šalje se…",
  empty: "Upišite objašnjenje ili zatvorite prozor.",
  saved: "Objašnjenje je zabilježeno uz nalaz. Vidi ga i nastavnik.",
  explained: "Objašnjenje je zabilježeno uz nalaz.",
  failed: "Objašnjenje nije stiglo na poslužitelj. Pokušaj ponovno.",
  rejected: "Objašnjenje mora imati tekst, najviše 2000 znakova.",
  conflict: "Za ovaj dio objašnjenje je već zabilježeno.",
  signedOut: "Sesija je istekla. Prijavi se ponovno.",
  dismiss: "Sakrij obavijest",
  // ED-38: the line in the "Uz tekst" alert row (prune.js `ctxAlerts`).
  row: (n: number) => `${n} ${pluralHr(n, "mjesto se podudara", "mjesta se podudaraju", "mjesta se podudara")} s odgovorom pomoćnika`,
} as const;
