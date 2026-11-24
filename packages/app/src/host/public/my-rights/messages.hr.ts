// "Moja prava" (NF-7 OA-5): a static help page for the student. It adds no function; it says whom to ask. The text waits for
// the legal review (the page says so) and judges no one.
export const myRightsMessages = {
  title: "Moja prava",
  lead: "Što možete tražiti u vezi s podacima koje Ductura čuva o vama i kome se javiti.",
  pendingReview: "Ova uputa čeka pravni pregled.",
  sections: [
    {
      id: "uvid",
      heading: "Uvid u podatke",
      text: "Možete zatražiti uvid u podatke koje Ductura čuva o vama. Zahtjev podnosite referadi svog fakulteta.",
    },
    {
      id: "izvoz",
      heading: "Izvoz podataka",
      text: "Možete zatražiti izvoz svojih podataka. Izvoz pokreće administrator fakulteta nakon vašeg zahtjeva referadi, a vi dobivate poveznicu za jednokratno preuzimanje.",
    },
    {
      id: "ispravak",
      heading: "Ispravak i brisanje",
      text: "Ispravak ili brisanje podataka za sada se zatražuje izvan aplikacije, izravno referadi fakulteta. Brisanje nije moguće dok za podatke vrijedi zakonska obveza čuvanja ili pravno zadržavanje.",
    },
    {
      id: "trajanje",
      heading: "Koliko traje",
      text: "Na zahtjev odgovara fakultet. Rok za odgovor određuje fakultet, a ako ga još nije odredio, to će vam reći referada.",
    },
  ],
  contact: "Ako ne znate kome se javiti, obratite se referadi fakulteta na kojem studirate.",
} as const;
