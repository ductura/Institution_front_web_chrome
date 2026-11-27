/**
 * Interface text of "Sigurnosni ključ" (F4-PM2-R16, E2): the operator confirms an already signed-in session with
 * a security key (auth.webauthn-*). It is no way to sign in: students and staff sign in only through AAI@EduHr (D-09).
 */
export const securityKeyMessages = {
  title: "Sigurnosni ključ",
  lead: "Potvrdite operatersku sesiju sigurnosnim ključem. Ovo nije prijava: u aplikaciju se i dalje ulazi samo preko AAI@EduHr.",
  registerTitle: "Dodaj ključ",
  registerBody: "Povežite sigurnosni ključ ili otisak prsta ovog uređaja s operaterskim računom.",
  register: "Dodaj ključ",
  confirmTitle: "Potvrdi ključem",
  confirmBody: "Potvrdite sesiju ključem koji ste već dodali.",
  confirm: "Potvrdi ključem",
  working: "Čekam ključ…",
  registered: "Ključ je dodan.",
  confirmed: "Sesija je potvrđena ključem.",
  unsupported: "Ovaj preglednik ne podržava sigurnosne ključeve.",
  cancelled: "Postupak je prekinut ili je istekao. Pokušajte ponovno.",
  noKey: "Za ovaj račun još nije dodan nijedan ključ. Prvo dodajte ključ.",
  already: "Taj ključ je već dodan.",
  denied: "Za sigurnosni ključ potrebna je prijavljena operaterska sesija.",
  rejected: "Poslužitelj nije prihvatio ključ. Pokušajte ponovno ili dodajte novi.",
  replay: "Poslužitelj je odbio potvrdu jer ključ nije valjan za ovaj pokušaj. Pokušajte ponovno.",
  unavailable: "Sigurnosni ključ trenutačno nije moguće upotrijebiti. Pokušajte ponovno.",
} as const;
