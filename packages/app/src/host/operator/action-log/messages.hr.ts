/**
 * Interface text of "Dnevnik radnji" (NF-7 OA-3, prototype screen `dnevnik`). The server has no
 * read of the administrators' and operators' actions yet (SRV-ADMIN-3), so the page says so
 * honestly and lists what the log will hold; it never shows invented rows.
 */
export const actionLogMessages = {
  title: "Dnevnik radnji",
  lead: "Što su radili administrator fakulteta i operater. Samo čitanje, bez podataka o studentima.",
  unavailableTitle: "Dnevnik radnji još nije dostupan",
  unavailableBody: "Poslužitelj još ne daje zapis radnji administratora i operatera. Kad bude dostupan, ovdje će se vidjeti svaka radnja s vremenom i ulogom.",
  kindsTitle: "Što će dnevnik bilježiti",
  kindsCaption: "Vrste radnji u dnevniku",
  kind: "Radnja",
  who: "Tko je obavlja",
  kinds: [
    { id: "role", label: "Uloga potvrđena ili povučena", who: "administrator fakulteta" },
    { id: "rule", label: "Pravilo objavljeno", who: "administrator fakulteta" },
    { id: "threshold", label: "Prag promijenjen", who: "administrator fakulteta" },
    { id: "hold", label: "Zadržavanje postavljeno ili skinuto", who: "administrator fakulteta" },
    { id: "export", label: "Izvoz podataka zatražen ili odobren", who: "referada i administrator fakulteta" },
  ],
  privacy: "Dnevnik ne prikazuje imena studenata ni sadržaj radova.",
} as const;
