// WEB-V13-PREDAJA: the words of the submission of a slides work. Outcomes, the late and
// "not open" lines and the newer-version dialog buttons keep the words of the text submission
// (student/submission/submit/messages.hr.ts); only what is true of slides is written here.
export const slidesSubmitText = {
  title: "Predati prezentaciju?",
  serverNote: "Predaje se točno ova prezentacija, onako kako je spremljena na poslužitelju. Izmjene koje još nisu stigle na poslužitelj nisu u predaji.",
  noLonger: "Nakon predaje prezentaciju više nije moguće mijenjati.",
  slides: "Slajdova u predanoj prezentaciji",
  loading: "Učitavam stanje prezentacije s poslužitelja.",
  loadError: "Stanje prezentacije trenutačno nije moguće učitati, pa se ne vidi je li rad predan. Ako je predaja zabilježena, ovdje će stajati potvrda.",
  notSlides: "Ovaj rad nije prezentacija, pa se ne predaje na ovoj stranici.",
  empty: "Na poslužitelju još nema slajdova ove prezentacije. Predaja je moguća kad prvi slajd stigne na poslužitelj.",
  tooFew: "Zadatak traži najmanje {min} slajdova, a na poslužitelju ih je {count}. Rad nije predan.",
  tooMany: "Zadatak dopušta najviše {max} slajdova, a na poslužitelju ih je {count}. Rad nije predan.",
  unreadableRange: "Broj slajdova koji zadatak traži trenutačno nije moguće pročitati. Poslužitelj ga provjerava pri predaji.",
  offline: "Nema veze s poslužiteljem. Predaja traži vezu; prezentacija je spremljena na uređaju i šalje se čim se veza vrati.",
  dialogText: "Predaje se prezentacija „{title}” spremljena na poslužitelju",
  dialogSlides: ". Slajdova: {n}.",
  openWorkspace: "Otvori radni prostor",
  // Owner decision 27. 11. 2026. (row 62): the newer-version dialog speaks of the slides, not of a text.
  newerText: "Na ovom uređaju postoji novija verzija prezentacije koju poslužitelj još nije potvrdio. Pošaljite je najprije ili predajte verziju koju je poslužitelj potvrdio.",
} as const;
