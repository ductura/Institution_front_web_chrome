# Sistemski testovi (INT-02 i INT-03)

Pokreni `pnpm stog:gore` u repou `Institution_server` prema njegovu `docs/lokalno/STOG.md` (INT-01). Pokretač treba otvoriti ovaj checkout weba. Ako web klon nije u zadanoj susjednoj mapi, postavi `STOG_FRONT_DIR` pri pokretanju stoga.

U ovom repou pokreni `pnpm exec playwright install chromium` ako preglednik još nije instaliran, zatim `pnpm test:sistem`. Test koristi lokalni Next.js na `localhost:3000`, stvarni Institution_server s PostgreSQL-om i lokalni simulator AAI@EduHr na `localhost:8090`. Ako je stog podignut s drugim `STOG_FRONT_PORT`, postavi istu vrijednost za test.

Ispis sadrži pune Git SHA-ove oba checkouta. Poslužitelj se zadano traži u `../Institution_server` u odnosu na ovaj repo. Za drugi put postavi `STOG_SERVER_DIR` na apsolutnu putanju ili putanju u odnosu na ovaj repo. Pokreni stog iz tih checkouta i ostavi ih na istim revizijama tijekom provjere.

- INT-02 (VS-1) se prijavi kao `demo-student`, otvori rad o kućnom kompostiranju, doda jedinstvenu izmišljenu rečenicu i pričeka potvrdu spremanja na poslužitelju. Zatim osvježi stranicu i provjeri da je rečenica i dalje u radu. Za samostalno pokretanje koristi `pnpm test:sistem vs1-prijava-spremi-osvjezi`.
- INT-03 dodaje dva odlomka, pričeka spremanje snimke s obama odlomcima, potvrdi Izjavu i preda reviziju s oba odlomka u pregledu. Test provjerava Ed25519 potpis javnim ključem iz `/api/v1/evidence/open`, prikaz otiska na zaslonu potvrde, istu potvrdu iz API-ja i zaključavanje rada pri ponovnom otvaranju. Za samostalno pokretanje koristi `pnpm test:sistem zavrsna-predaja-studenta`.

Oba testa koriste isti demo rad. U punom paketu VS-1 ide prije nepovratne predaje. INT-03 pokreni s radom koji još nije predan. Za sljedeći puni prolaz pripremi svježu lokalnu ili CI bazu sa seedom, jer ponovno pokretanje stoga zadržava predani rad.

Za spremanje su potrebni pohrana evidencije i registrirani razvojni ključ za potpis potvrde. Ako commit vrati `503` u fazi `storage` ili `signing`, u pokretaču INT-01 provjeri te ovisnosti. `pnpm stog:zdravlje` provjerava dostupnost servisa i vezu s bazom.
