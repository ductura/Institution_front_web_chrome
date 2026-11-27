// WEB-V21-KOD-POKRETANJE: tekstovi pokretanja testova nad blokom koda.
export const codeRunHr = {
  run: "Pokreni testove",
  title: "Rezultat testova",
  notice: "Pokrenuto u vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu.",
  running: "Pokrećem testove…",
  close: "Zatvori",
  retry: "Pokušaj ponovno",
  unavailable: "Testovi trenutačno nisu dostupni. Pokušajte ponovno.",
  frameFailed: "Pokretanje u pregledniku nije uspjelo. Pokušajte ponovno.",
  missingSolve: "Kod nema funkciju solve. Dodajte funkciju solve(ulaz) koja vraća rezultat.",
  summary: (passed: number, total: number) => `Prošlo ${passed} od ${total} testova.`,
  status: { passed: "prošao", failed: "pao", timeout: "vrijeme isteklo", error: "greška" },
  input: "Ulaz",
  expected: "Očekivano",
  actual: "Dobiveno",
  errorIn: "Greška u kodu:",
  timedOut: (seconds: number) => `Izvršavanje je prekinuto nakon ${seconds} s.`,
} as const;
