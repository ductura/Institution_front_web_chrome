// Texts of the requested proofs (prototype nf2.js reqBlock; the rehearsal row for the counts).
export const proofRequestsHr = {
  title: "Zatražene potvrde",
  titleOpen: (n: number) => `Zatražene potvrde (${n} ${n % 10 === 1 && n % 100 !== 11 ? "otvorena" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "otvorene" : "otvorenih"})`,
  loading: "Učitavam zahtjeve nastavnika…",
  error: "Zahtjeve nastavnika trenutačno nije moguće dohvatiti.",
  retry: "Pokušaj ponovno",
  none: "Nastavnik za sada nije zatražio potvrde.",
  allDone: "Sve zatražene potvrde su priložene.",
  open: (n: number, m: number) => `Još ${n} od ${m} čeka potvrdu.`,
  item: (label: string | null) => `Zatražena potvrda: ${label ?? "izvor koji više nije u radu"}`,
  due: (day: string) => `Rok ${day}`,
  overdue: (day: string) => `Rok je istekao ${day}`,
  how: "Potvrdu prilažete u odjeljku „Potvrde iz izvora” niže.",
  only: "Vidite samo ono što je nastavnik namijenio studentu; radne bilješke mentora ne vidite.",
} as const;
