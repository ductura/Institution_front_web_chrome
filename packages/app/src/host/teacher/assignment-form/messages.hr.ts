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
  sections: { basics: "Osnovno", schedule: "Rok i opseg", rules: "Pravila o Asistentu i alatima", submitRules: "Pravila predaje", recorded: "Što se bilježi" },
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
    fixed: "Vrsta zadatka određuje se pri objavi. Nova verzija je ne mijenja.",
  },
  groups: {
    legend: "Grupe",
    loading: "Učitavanje grupa…",
    // The groups cannot be read: shown honestly, the assignment then goes to every enrolled student.
    unavailable: "Grupe kolegija trenutačno se ne mogu učitati. Zadatak vide svi studenti upisani u kolegij.",
    none: "Kolegij nema grupa. Zadatak vide svi upisani studenti.",
    hint: "Zadatak vide samo studenti odabranih grupa.",
  },
  submitRules: {
    note: "Ova pravila student vidi na koraku predaje. Kasnije ih možete promijeniti na stranici zadatka.",
    lateLegend: "Predaja nakon roka",
    lateAllowed: "Dopuštena (predaja se označi kao kasna)",
    lateDenied: "Nije dopuštena",
    lateUnavailable: "Zabrana predaje nakon roka trenutačno nije dostupna. Do tada vrijedi pravilo poslužitelja.",
    withdrawalLegend: "Povlačenje predaje",
    withdrawalOn: "Student smije povući predaju dok rok traje",
    withdrawalOff: "Student ne smije povući predaju",
    declarationLegend: "Izjava o pomoći pri predaji",
    declarationOn: "Izjava je obavezna",
    declarationOff: "Izjava nije obavezna",
    seesIntro: "Student na koraku predaje vidi:",
    seesWithdrawal: { on: "predaju može povući dok rok traje", off: "predaju ne može povući" },
    seesDeclaration: { on: "izjavu mora ispuniti", off: "izjavu ne mora ispuniti" },
    failed: {
      withdrawal: "Pravilo o povlačenju nije spremljeno. Zadatak je objavljen; pravilo postavite na stranici zadatka.",
      declaration: "Pravilo o izjavi nije spremljeno. Zadatak je objavljen; pravilo postavite na stranici zadatka.",
    },
    live: {
      heading: "Pravila predaje",
      loading: "Učitavanje pravila predaje…",
      unavailable: "Pravila predaje trenutačno se ne mogu učitati. Pokušajte ponovno.",
      retry: "Pokušaj ponovno",
      save: "Spremi pravila predaje",
      saved: "Pravila predaje su spremljena.",
      notSaved: "Pravila predaje nisu spremljena. Pokušajte ponovno.",
      unchanged: "Nema izmjena za spremanje.",
      confirmTitle: "Promjena pravila predaje",
      confirmBody: "Ova izmjena mijenja pravila koja su studenti već vidjeli.",
      confirm: "Spremi izmjenu",
      cancel: "Odustani",
    },
  },
  rules: {
    note: "Pravilo kolegija polazi od pravila fakulteta. Pravilo zadatka može ga samo suziti, ne proširiti.",
    aiLegend: "Asistent u Ducturi",
    aiCourse: "Kao u kolegiju: dopušten za sažimanje literature i objašnjenje pojma, uz izjavu",
    aiSummary: "Samo sažimanje literature, uz izjavu",
    aiSummaryHint: "Student smije tražiti samo sažetak literature.",
    aiNone: "Nije dopušten u ovom zadatku",
    courseProhibits: "Kolegij ne dopušta pomoć Asistenta, pa je zadatak bez nje.",
    toolsLegend: "Vanjski alati",
    toolsYes: "Dopušteni uz izjavu (kao u kolegiju)",
    toolsNo: "Nisu dopušteni u ovom zadatku",
    toolsHint: "Student o vanjskim alatima daje izjavu pri predaji.",
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
    groups: "odaberite barem jednu grupu.",
    opensAt: "odaberite otvaranje zadatka.",
    dueAt: "odaberite rok zadatka.",
    dueBeforeOpen: "rok mora biti nakon otvaranja.",
    words: "broj riječi mora biti cijeli broj, a najmanji ne smije biti veći od najvećeg.",
  },
  reviewHeading: "Podaci zadatka",
  reviewIntro: "Provjerite podatke. Zadatak se objavljuje tek kad ovdje potvrdite objavu.",
  labels: { course: "Kolegij", title: "Naslov", workType: "Vrsta rada", opens: "Otvaranje", due: "Rok", words: "Opseg", groups: "Grupe", ai: "Asistent", tools: "Vanjski alati", kind: "Vrsta zadatka", documentKind: "Vrsta dokumenta", withdrawal: "Povlačenje predaje", declaration: "Izjava pri predaji", late: "Predaja nakon roka" },
  values: {
    aiCourse: "Prema pravilima kolegija", aiSummary: "Samo sažimanje literature", aiNone: "Bez pomoći Asistenta", groupsAll: "svi upisani studenti",
    toolsYes: "dopušteni uz izjavu", toolsNo: "nisu dopušteni", practice: "Probni zadatak, bez ocjene", regular: "Redovni zadatak",
    withdrawalOn: "dopušteno dok rok traje", withdrawalOff: "nije dopušteno", declarationOn: "obavezna", declarationOff: "nije obavezna",
    lateServer: "prema pravilu poslužitelja",
  },
  publish: "Objavi zadatak",
  backToForm: "Natrag na obrazac",
} as const;

/** WEB-V13-VRSTA-ZADATKA: the teacher picks what the student writes, text or slides. */
export const documentKindHr = {
  legend: "Vrsta dokumenta",
  options: { text: "Tekst", slides: "Slajdovi", spreadsheet: "Tablica" },
  textHint: "Student piše tekstni rad u uredniku.",
  slidesHint: "Student izrađuje slajdove. Vrsta se određuje pri objavi zadatka.",
  spreadsheetHint: "Student izrađuje tablicu s formulama. Vrsta se određuje pri objavi zadatka.",
  unknown: "nije prikazana",
  fixed: "Vrsta se određuje pri objavi zadatka; nova verzija je ne mijenja.",
} as const;

/** NF-4 NZ-15: the teacher's question beside the declaration (teacher.declaration-question.get/put). */
export const declarationQuestionHr = {
  label: "Pitanje studentu uz izjavu (nije obavezno)",
  hint: "Do {max} znakova. Student ga vidi na koraku „Izjava”; odgovor vidite uz izjavu na pregledu rada. Bez pitanja izjava radi kao i dosad.",
  errors: {
    tooLong: "Pitanje može imati najviše {max} znakova.",
    invalid: "Pitanje sadrži znak koji nije dopušten.",
  },
  reviewLabel: "Pitanje uz izjavu",
  reviewNone: "Bez pitanja",
  failed: {
    signedOut: "Pitanje uz izjavu nije spremljeno jer je prijava istekla. Prijavite se i dodajte ga na stranici za uređivanje zadatka.",
    invalid: "Pitanje uz izjavu nije spremljeno jer ga poslužitelj nije prihvatio. Izmijenite ga na stranici za uređivanje zadatka.",
    failed: "Zadatak je objavljen, ali pitanje uz izjavu nije spremljeno. Dodajte ga na stranici za uređivanje zadatka.",
  },
  live: {
    loading: "Učitavanje pitanja uz izjavu…",
    unavailable: "Pitanje uz izjavu trenutačno se ne može učitati. Pokušajte ponovno.",
    retry: "Pokušaj ponovno",
    save: "Spremi pitanje uz izjavu",
    saved: "Pitanje uz izjavu je spremljeno.",
    notSaved: "Pitanje uz izjavu nije spremljeno. Pokušajte ponovno.",
    invalid: "Poslužitelj nije prihvatio pitanje. Provjerite tekst i pokušajte ponovno.",
  },
} as const;

/** WEB-V17-TEMPLATE-PICK: the faculty template switch of the form and the outline shown under it. */
export const templateFieldHr = {
  label: "Koristi fakultetski predložak rada",
  off: "Student počinje s praznim radom.",
  on: "Student pri početku rada dobiva naslovnu i prazne odjeljke predloška. Zamrzava se trenutačna verzija predloška.",
  loading: "Učitavam kostur predloška.",
  none: "Za ovu vrstu rada fakultet još nema predložak. Zadatak se objavljuje bez njega.",
  unavailable: "Kostur predloška trenutačno nije dostupan za pregled. Student ga svejedno dobiva ako je predložak zadan.",
  version: (n: number) => `Verzija predloška: ${n}`,
  titlePage: "Naslovna",
  titleFields: { title: "Naslov", author: "Autor", mentor: "Mentor", course: "Kolegij", date: "Datum" },
  sections: "Odjeljci",
  noSections: "Predložak nema odjeljaka.",
  reviewLabel: "Predložak",
  reviewOn: "Fakultetski predložak",
  reviewOff: "Bez predloška",
  failed: {
    failed: "Predložak nije uključen na zadatak. Zadatak je objavljen; predložak možete uključiti kasnije.",
    conflict: "Predložak nije uključen jer je poslužitelj već promijenio zadatak. Zadatak je objavljen.",
    signedOut: "Predložak nije uključen jer ste odjavljeni. Zadatak je objavljen.",
  },
} as const;
