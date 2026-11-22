// WEB-1801 (M8.2b): the teacher's switch "Dopušten uvoz" in the assignment form.
export const importAllowedHr = {
  label: "Dopušten uvoz",
  hint: "Student smije uvesti postojeći tekst iz DOCX ili PDF datoteke. Prije umetanja vidi pregled i potvrđuje uvoz; uvezeni tekst ostaje označen kao uvezen. Kasnije se uvoz u novoj verziji zadatka smije samo isključiti.",
  off: "Uvoz nije dopušten: student ne vidi gumb za uvoz.",
} as const;

// WEB-2146 (N-02/N-03): one form in sections zs-1 to zs-4 and a separate review, as in the prototype.
export const assignmentFormHr = {
  heading: "Novi zadatak",
  intro: "Jedan obrazac u odjeljcima. Ništa se ne objavljuje prije koraka „Pregled i objava”.",
  course: "Kolegij",
  sections: { basics: "Osnovno", schedule: "Rok i opseg", rules: "Pravila o AI pomoći i alatima", recorded: "Što se bilježi" },
  fields: {
    title: "Naslov zadatka", titleHint: "Do 160 znakova.", workType: "Vrsta rada", description: "Opis zadatka",
    opens: "Otvaranje", opensHint: "Od tada student može započeti rad. Vrijeme u Zagrebu.",
    due: "Rok", dueHint: "Po zagrebačkom vremenu; mora biti nakon otvaranja.",
    wordMin: "Najmanje riječi", wordMax: "Najviše riječi",
  },
  practice: {
    label: "Probni zadatak (bez ocjene)",
    hint: "Student i nastavnik vide oznaku „Probni”. Probni zadatak nema polje ocjene.",
    off: "Zadatak se vrednuje kao i obično.",
  },
  groups: {
    legend: "Grupe",
    // The create route has no `groupIds` yet and the course groups are not read here: shown, not sent.
    unavailable: "Odabir grupa trenutačno je nedostupan. Zadatak vide svi studenti upisani u kolegij.",
  },
  rules: {
    note: "Pravilo kolegija polazi od pravila fakulteta. Pravilo zadatka može ga samo suziti, ne proširiti.",
    aiLegend: "AI pomoćnik u Ducturi",
    aiCourse: "Kao u kolegiju: dopušten za sažimanje literature i objašnjenje pojma, uz izjavu",
    aiSummary: "Samo sažimanje literature, uz izjavu",
    aiSummaryUnavailable: "Odabir „Samo sažimanje” trenutačno je nedostupan.",
    aiNone: "Nije dopušten u ovom zadatku",
    courseProhibits: "Kolegij ne dopušta AI pomoć, pa je zadatak bez nje.",
    toolsLegend: "Vanjski alati",
    toolsYes: "Dopušteni uz izjavu (kao u kolegiju)",
    toolsNo: "Nisu dopušteni u ovom zadatku",
    toolsUnavailable: "Odabir vanjskih alata trenutačno je nedostupan.",
    seen: "Isto pravilo student vidi u obavijesti prije početka rada i u izjavi pri predaji.",
  },
  recorded: {
    note: "Ovo nije postavka zadatka: isto se bilježi u svakom radu, a student to vidi u obavijesti prije početka rada.",
    items: [
      "tekst rada i svaka promjena, s vremenom primitka na poslužitelj",
      "sesije: niz promjena bez prekida duljeg od 30 minuta (prag P-01, postavka fakulteta)",
      "lijepljenja dulja od 200 znakova (prag P-02), bez izvora ako izvor nije opažen",
      "uvoz datoteke i prijenos teksta iz AI pomoćnika",
      "poslane verzije, predaja i potvrda s otiskom teksta",
    ],
    scope: "Ductura ne bilježi ništa izvan rada: ni druge prozore, ni zaslon, ni kameru. Ne zna tko je tipkao.",
  },
  submitHint: "Ovim gumbom ništa se ne objavljuje. Sljedeći je korak „Pregled i objava”, gdje potvrđujete objavu.",
  review: "Pregled i objava",
  cancel: "Odustani",
  errorsPrefix: "Obrazac ima pogreške:",
  errors: {
    title: "naslov je obavezan i smije imati najviše 160 znakova.",
    instructions: "opis smije imati najviše 20 000 znakova.",
    opensAt: "odaberite otvaranje zadatka.",
    dueAt: "odaberite rok zadatka.",
    dueBeforeOpen: "rok mora biti nakon otvaranja.",
    words: "broj riječi mora biti cijeli broj, a najmanji ne smije biti veći od najvećeg.",
  },
  reviewHeading: "Podaci zadatka",
  reviewIntro: "Provjerite podatke. Zadatak se objavljuje tek kad ovdje potvrdite objavu.",
  labels: { course: "Kolegij", title: "Naslov", workType: "Vrsta rada", opens: "Otvaranje", due: "Rok", words: "Opseg", groups: "Grupe", ai: "AI pomoćnik", tools: "Vanjski alati", kind: "Vrsta zadatka" },
  values: {
    aiCourse: "Prema pravilima kolegija", aiNone: "Bez AI pomoći", groupsAll: "svi upisani studenti",
    toolsUnavailable: "nedostupno", practice: "Probni zadatak, bez ocjene", regular: "Redovni zadatak",
  },
  publish: "Objavi zadatak",
  backToForm: "Natrag na obrazac",
} as const;
