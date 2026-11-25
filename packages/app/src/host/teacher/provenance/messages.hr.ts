// Interface copy of "Karta podrijetla" (WEB-2158; N-10 km-h). Texts as in Ductura_nastavnik.html provMap();
// the three state lines at the end are not in the prototype and are listed as assumptions in the pull request.
export const provenanceText = {
  title: "Karta podrijetla",
  intro: "Pokazuje gdje je tekst ušao lijepljenjem, uvozom ili prijenosom iz AI pomoćnika, te gdje je mijenjao nastavnik. Bez zbroja i bez izračuna.",
  whoTyped: "Ductura ne zna tko je tipkao.",
  switchOrigin: "Podrijetlo teksta",
  switchTyped: "Napisano u Ducturi",
  typedHint: "„Napisano u Ducturi” znači da je tekst nastao u uređivaču Ducture; oznaka navodi mjesto, ne osobu. Vidi se samo dok je uključeno „Podrijetlo teksta”.",
  legendLabel: "Legenda karte",
  legendPaste: "zalijepljeno · crtkana crta",
  legendAi: "umetnuto iz Asistenta · dvostruka crta",
  legendImport: "uvezeno iz datoteke · točkasta crta",
  legendTeacher: "izmjena nastavnika · valovita crta",
  legendOpen: "mjesto za izvor · crtkani okvir",
  legendTyped: "napisano u Ducturi · crta uz lijevi rub",
  noMarks: "U ovom radu nema lijepljenja, uvoza ni prijenosa iz AI pomoćnika, pa karta nema oznaka.",
  unavailable: "Kartu podrijetla trenutačno nije moguće učitati. Pokušajte ponovno; zapis time nije zahvaćen.",
  retry: "Pokušaj ponovno",
  notFound: "Rad nije pronađen.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  textUnavailable: "Tekst rada s označenim mjestima još nije dostupan.",
} as const;
