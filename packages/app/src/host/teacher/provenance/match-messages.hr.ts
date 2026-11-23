// Interface copy of the assistant match (PIL-P1-PODUDARANJE-KARTA; WEB-1230; P-1 rule 13; D-58; D-41). No text says
// "prepisano" or claims authorship; the match is a plain comparison of text.
export const matchText = {
  heading: "Podudaranje s odgovorom pomoćnika",
  // Neutral for both sides: the student and the teacher read the same intro (P-1 rule 2.2).
  intro: "Osam ili više riječi zaredom u ovom radu jednako je odgovoru pomoćnika u Ducturi. Razgovor s tim odgovorom automatski je priložen izjavi kao preneseni tekst.",
  neutral: "Ovo je obična usporedba teksta i ništa ne govori o autorstvu.",
  caption: "Priloženi razgovori s pomoćnikom",
  noConversation: "Uz ovaj udio još nema priloženog razgovora.",
  colWords: "Riječi zaredom",
  colRecorded: "Zabilježeno",
  colAttached: "Razgovor priložen izjavi",
  words: (n: number): string => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "riječ" : "riječi"}`,
  unavailable: "Podudaranje s odgovorom pomoćnika trenutačno nije moguće dohvatiti.",
  retry: "Pokušaj ponovno",
} as const;
