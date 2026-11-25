/**
 * Interface text of "Dnevnik radnji" (NF-7 OA-3, prototype screen `dnevnik`): the read of
 * institution.admin-actions.get. The entries hold roles and times only, never a student.
 */
export const actionLogMessages = {
  title: "Dnevnik radnji",
  lead: "Što su radili administrator fakulteta i operater. Samo čitanje, bez podataka o studentima.",
  entriesTitle: "Zabilježene radnje",
  table: "Radnje administratora i operatera",
  when: "Vrijeme",
  action: "Radnja",
  actor: "Tko je radio",
  subject: "Na koga se odnosi",
  noSubject: "—",
  truncated: "Prikazano je samo najnovijih {count} radnji. Starije su u dnevniku, ali se ovdje ne vide.",
  emptyTitle: "Još nema zabilježenih radnji",
  emptyBody: "Kad administrator fakulteta ili operater obavi radnju iz popisa niže, pojavit će se ovdje s vremenom i ulogom.",
  denied: "Nemate ovlasti za dnevnik radnji.",
  unavailable: "Dnevnik radnji trenutačno nije moguće učitati. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  actions: {
    role_confirmed: "Uloga potvrđena",
    role_revoked: "Uloga povučena",
    rule_published: "Pravilo objavljeno",
    threshold_changed: "Prag promijenjen",
    hold_placed: "Zadržavanje postavljeno",
    hold_released: "Zadržavanje skinuto",
    export_requested: "Izvoz podataka zatražen",
    export_approved: "Izvoz podataka odobren",
  },
  roles: {
    institution_admin: "administrator fakulteta",
    registry_clerk: "referada",
    operator: "operater",
    network_engineer: "operater",
    teacher: "nastavnik",
  },
  privacy: "Dnevnik ne prikazuje imena studenata ni sadržaj radova.",
} as const;
