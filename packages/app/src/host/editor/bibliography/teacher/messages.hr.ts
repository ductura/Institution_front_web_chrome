/** Interface text of the teacher's bibliography tools (WEB-2133, INVENTAR-editor §2.4 sources2.js). */
export const bibliographyTeacherHr = {
  heading: "Izvori",
  loading: "Učitavam literaturu rada…",
  unavailable: "Literatura rada se zasad ne može učitati.",
  retry: "Pokušaj ponovno",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  noVersion: "Student još nema spremljenu verziju rada.",
  basis: (date: string) => `Prema zadnjoj spremljenoj verziji rada (${date}).`,
  // Top of Izvori (sources2.js srcTop).
  recommend: "+ Preporuči izvor",
  overview: "Pregled literature",
  // Requested proofs (s2Req, proofReq).
  requests: "Zatražene potvrde",
  requestsWaiting: (n: number) => `${n} ${plural(n, "navod čeka", "navoda čekaju", "navoda čeka")} potvrdu.`,
  requestsNone: "Uz navode nema zatraženih potvrda.",
  requestPlace: (label: string, page: string | null) => (page ? `${label}, str. ${page}` : label),
  requestOpen: (label: string, due: string, instruction: string) => `${label}: rok ${due} – ${instruction}`,
  request: "Zatraži potvrdu",
  requestSend: "Pošalji zahtjev",
  requested: "Zahtjev za potvrdu je poslan studentu.",
  withdraw: "Povuci zahtjev",
  withdrawn: "Zahtjev je povučen.",
  instruction: "Što student treba potvrditi",
  due: "Rok",
  instructionInvalid: "Upišite što student treba potvrditi (najviše 1000 znakova).",
  dueInvalid: "Odaberite rok koji nije prošao.",
  // Recommended and mandatory sources (s2Rec, s2ObNew).
  recommended: "Preporučeni izvori",
  recommendUnavailable: "Preporuke izvora zasad nisu dostupne: rad se ne može mijenjati ili nemate pravo pisanja.",
  recommendedNone: "Još nema preporučenih izvora.",
  recommended_ok: "Izvor je preporučen studentu.",
  removed: "Izvor je uklonjen s popisa.",
  remove: "Ukloni",
  workSources: "Izvori rada",
  proofsOf: (n: number) => `Potvrde (${n})`,
  proofsTitle: "Potvrde izvora",
  proofsNone: "Student još nije priložio potvrdu uz ovaj izvor.",
  proofsFailed: "Potvrde se zasad ne mogu učitati.",
  proofPlace: (page: string) => `str. ${page}`,
  writeFailed: "Radnja nije spremljena. Pokušajte ponovno.",
  cancel: "Odustani",
  mandatory: "Obvezna literatura kolegija",
  mandatoryAdd: "+ Obvezni izvor",
  mandatoryNone: "Još nema obvezne literature za ovaj rad.",
  // Literature overview dialog (litview).
  summary: (total: number, cited: number) => `${total} ${plural(total, "izvor", "izvora", "izvora")} · citirano ${cited}`,
  summarySeen: (date: string, n: number) => ` · novo od pregleda ${date}: ${n}`,
  summaryNotSeen: " · mentor još nije označio pregled",
  colSource: "Izvor",
  colKind: "Vrsta",
  colCites: "Navoda",
  fresh: "novo",
  empty: "Još nema izvora.",
  markSeen: "Označi literaturu pregledanom",
  markedSeen: "Zapisano. Izvori dodani nakon ovoga bit će označeni kao novi.",
  seenDevice: "Vrijeme pregleda sprema se na poslužitelju; popis pregledanih izvora samo na ovom uređaju.",
  close: "Zatvori",
  readOnly: "Suradnik literaturu samo čita.",
  submitted: "Rad je predan: preporuke i zahtjevi više se ne šalju.",
  typeBook: "knjiga",
  typeArticle: "članak",
  typeChapter: "poglavlje u knjizi",
  typeWeb: "mrežni izvor",
} as const;

/** Croatian plural: 1, 2–4 and the rest (11–14 take the last form). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}
