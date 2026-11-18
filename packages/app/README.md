# packages/app

Domaćin fronta institucije (ugovor #2028 c.6993786629 §1 i §3.3). Ekrani su iz `src/components`, API ide kroz `src/client/api.ts`.

| Datoteka | Što |
| --- | --- |
| `src/main.tsx` | Ulaz: tema (tamna je zadana, D-188) i `App` s bazom iz adrese (`/app/web` ili `/app/chrome`). |
| `src/App.tsx` | Jedno čitanje sesije. Na 401 preusmjerava na prijavu, a na grešku pokazuje ekran s „Pokušaj ponovno”. Ljuska prikazuje ulogu, ime ustanove i „Odjava”. Router je `history` bez novih ovisnosti; poveznice aplikacije otvaraju se bez ponovnog učitavanja. |
| `src/routes.ts` | Čiste funkcije: baza, putanja, stranica po ulozi (rute iz `src/components/shell/nav.ts`), preusmjeravanje na početni ekran uloge. |
| `src/text.ts` | Nekoliko tekstova samog domaćina. `text.test.ts` ih provjerava skenerom zabranjenih izraza. |
| `e2e/session.spec.ts` | Lažni `/api/v1` (`page.route`): 401 vodi na prijavu s `returnTo`, 200 otvara ekran uloge, odjava, nedostupan poslužitelj. Uz to provjerava konzolu i axe. |

Spojeni su ekrani studenta S01 i S02 (`student.assignments.get`). Ostale rute iz navigacije zasad imaju naslov i napomenu da prikaz još nije spojen na poslužitelj ustanove. Spajaju se u sljedećem koraku.
