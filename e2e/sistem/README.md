# Sistemski testovi (INT-02, INT-03 i INT-04)

Pokreni `pnpm stog:gore` u repou `Institution_server` prema njegovu `docs/lokalno/STOG.md` (INT-01). Pokretač treba otvoriti ovaj checkout weba. Ako web klon nije u zadanoj susjednoj mapi, postavi `STOG_FRONT_DIR` pri pokretanju stoga.

U ovom repou pokreni `pnpm exec playwright install chromium` ako preglednik još nije instaliran, zatim `pnpm test:sistem`. Test koristi lokalni Next.js na `localhost:3000`, stvarni Institution_server s PostgreSQL-om i lokalni simulator AAI@EduHr na `localhost:8090`. Ako je stog podignut s drugim `STOG_FRONT_PORT`, postavi istu vrijednost za test.

Ispis sadrži pune Git SHA-ove oba checkouta. Poslužitelj se zadano traži u `../Institution_server` u odnosu na ovaj repo. Za drugi put postavi `STOG_SERVER_DIR` na apsolutnu putanju ili putanju u odnosu na ovaj repo. Pokreni stog iz tih checkouta i ostavi ih na istim revizijama tijekom provjere.

- INT-02 (VS-1) se prijavi kao `demo-student`, otvori rad o kućnom kompostiranju, doda jedinstvenu izmišljenu rečenicu i pričeka potvrdu spremanja na poslužitelju. Zatim osvježi stranicu i provjeri da je rečenica i dalje u radu. Za samostalno pokretanje koristi `pnpm test:sistem vs1-prijava-spremi-osvjezi`.
- INT-03 dodaje dva odlomka, pričeka spremanje snimke s oba odlomka, potvrdi Izjavu i preda pregledanu reviziju. Test provjerava Ed25519 potpis javnim ključem iz `/api/v1/evidence/open`, prikaz otiska na zaslonu potvrde, istu potvrdu iz API-ja i zaključavanje rada pri ponovnom otvaranju. Za samostalno pokretanje koristi `pnpm test:sistem zavrsna-predaja-studenta`.
- INT-04 čita spremljenu potvrdu iz INT-03. Kao `demo-teacher` otvara kolegij i odabire „Brz put”. Uz studenticu vidi „Predano”, otvara točan rad i provjerava da SHA-256 predanog teksta odgovara otisku s potvrde. U radu provjerava učitani „Sažetak procesa”. Komentar uz odlomak šalje i ponovno čita kroz stvarni `/api/v1/comments` iz iste pregledničke sesije. Drugi nastavnik iz iste ustanove u zasebnoj sesiji vidi samo svoj kolegij i nema pristup ciljnoj predaji, njezinu sažetku ni komentarima.

Za INT-04 nakon redovnog seeda učitaj `e2e/sistem/seed-int04.sql` u lokalnu ili CI bazu preko PostgreSQL socketa, istom administratorskom ulogom kao redovni seed. Za zadani Compose stog iz korijena web repoa na Linuxu ili u CI-ju pokreni:

```sh
docker compose -f ../Institution_server/compose.yaml exec -T postgres-main psql -U postgres -d ductus < e2e/sistem/seed-int04.sql
```

Svi testovi koriste isti demo rad. U punom paketu VS-1 ide prvi, zatim slijedi nepovratna predaja u INT-03 pa nastavnički pregled u INT-04. Za zaseban INT-04 koristi `pnpm test:sistem zbirni-pregled-predaje` nakon predaje iz INT-03 na istoj bazi. Za sljedeći puni prolaz pripremi svježu demo bazu i ponovno učitaj fixture jer ponovno pokretanje stoga zadržava predani rad.

INT-04 koristi nastavničke ekrane na Next.js frontu iz `pnpm stog:gore`. Komentar provjerava kroz API jer taj front na prikazu rada još nema obrazac za komentiranje.

Za spremanje su potrebni pohrana evidencije i registrirani razvojni ključ za potpis potvrde. Ako commit vrati `503` u fazi `storage` ili `signing`, u pokretaču INT-01 provjeri te ovisnosti. `pnpm stog:zdravlje` provjerava dostupnost servisa i vezu s bazom.
