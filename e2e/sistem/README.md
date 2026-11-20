# Sistemski test VS-1 (INT-02)

Pokreni `pnpm stog:gore` u repou `Institution_server` prema njegovu `docs/lokalno/STOG.md` (INT-01). Pokretač treba otvoriti ovaj checkout weba. Ako web klon nije u zadanoj susjednoj mapi, postavi `STOG_FRONT_DIR` pri pokretanju stoga.

U ovom repou pokreni `pnpm exec playwright install chromium` ako preglednik još nije instaliran, zatim `pnpm test:sistem`. Test koristi lokalni Next.js na `localhost:3000`, stvarni Institution_server s PostgreSQL-om i lokalni simulator AAI@EduHr na `localhost:8090`. Ako je stog podignut s drugim `STOG_FRONT_PORT`, postavi istu vrijednost za test.

Ispis sadrži pune Git SHA-ove oba checkouta. Poslužitelj se zadano traži u `../Institution_server` u odnosu na ovaj repo. Za drugi put postavi `STOG_SERVER_DIR` na apsolutnu putanju ili putanju u odnosu na ovaj repo. Pokreni stog iz tih checkouta i ostavi ih na istim revizijama tijekom provjere.

Test se prijavi kao `demo-student`, otvori rad o kućnom kompostiranju, doda jedinstvenu izmišljenu rečenicu i pričeka potvrdu spremanja na poslužitelju. Zatim osvježi stranicu i provjeri da je rečenica i dalje u radu. Rečenica ostaje u lokalnom demo radu.
