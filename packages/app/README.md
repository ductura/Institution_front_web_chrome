# packages/app

Domaćin fronta institucije (ugovor #2028 c.6993786629 §1 i §3.3). Ekrani su iz `src/components`, API ide kroz `src/client/api.ts`.

| Datoteka | Što |
| --- | --- |
| `src/main.tsx` | Ulaz: tema (tamna je zadana, D-188) i `App` s bazom iz adrese (`/app/web` ili `/app/chrome`). |
| `src/App.tsx` | Jedno čitanje sesije. Na 401 preusmjerava na prijavu, a na grešku pokazuje ekran s „Pokušaj ponovno”. Ljuska prikazuje ulogu, ime ustanove i „Odjava”. Router je `history` bez novih ovisnosti; poveznice aplikacije otvaraju se bez ponovnog učitavanja. |
| `src/routes.ts` | Čiste funkcije: baza, putanja, stranica po ulozi (rute iz `src/components/shell/nav.ts`), preusmjeravanje na početni ekran uloge. |
| `src/text.ts` | Nekoliko tekstova samog domaćina. `text.test.ts` ih provjerava skenerom zabranjenih izraza. |
| `e2e/session.spec.ts` | Lažni `/api/v1` (`page.route`): 401 vodi na prijavu s `returnTo`, 200 otvara ekran uloge, odjava, nedostupan poslužitelj, nastavnička čitanja (200, 401, 403, 503). Uz to provjerava konzolu i axe. Tijela nastavničkih odgovora u `e2e/fixtures/teacher.json` su vektori iz `@ductura/test-fakes` 3.0.1. |

Spojeni ekrani:

- student: S01 i S02 (`student.assignments.get`);
- nastavnik: „Moji kolegiji” (`teacher.courses.get`) i „Radovi uz mentora” (`teacher.mentorships.get`). Na 401 vodi na prijavu, na 403 traži nastavnički račun, a na ostalo javlja grešku i nudi „Pokušaj ponovno”.

Ostale rute iz navigacije zasad imaju naslov i napomenu da prikaz još nije spojen na poslužitelj ustanove. Ekrani administratora ustanove čekaju rute za čitanje u ugovoru; `@ductura/contracts` 2.8.0 za `/ustanova` ima samo POST.
