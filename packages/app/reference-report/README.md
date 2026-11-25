# packages/app/reference-report

Usporedni izvještaj stvarnih ekrana prema referentnim slikama (DAN-1565). Katalog komponenti uspoređuje komponente s vlastitim prethodnim snimkama; ovaj alat snima stvarnu aplikaciju i stavlja je uz referentnu sliku (Ductus `docs/SESSIONS.md` §6).

```bash
DUCTURA_REFERENCES=<put do docs/design/ductura> pnpm --filter @ductura/app run reference:report
```

Izvještaj je `packages/app/reference-report/dist/index.html` (mapa se ne sprema u git; `DUCTURA_REFERENCE_REPORT` je mijenja). To je jedna datoteka sa svim slikama u sebi i otvara se bez mreže. Uz nju su u `dist/snimke/` same snimke ekrana.

## Što radi

1. Izgradi aplikaciju i pokrene `dev-server.mjs` na vlastitom portu (5192).
2. Poslužitelj ustanove oponaša u pregledniku (`page.route`), s istim izmišljenim podacima kao `e2e/session.spec.ts`. Nijedan zahtjev ne izlazi iz preglednika.
3. Snimi cijelu stranicu svake spojene rute (`screens.ts`) na 1440 i 400 px, tamno i svijetlo: 16 snimki.
4. Za svaku snimku složi red: referenca, stvarna snimka i razlika, s udjelom piksela koji se razlikuju.

| Datoteka | Što |
| --- | --- |
| `screens.ts` | Ekrani, širine, teme i ime referentne slike za svaki ekran. |
| `diff.ts` | Razlika dviju slika u pregledniku (canvas), bez nove ovisnosti. Pokriva je `e2e/reference-diff.spec.ts`. |
| `html.ts` | Izvještaj kao tekst. Pokriva ga `html.test.ts`. |
| `capture.spec.ts` | Snimanje i pisanje izvještaja. Nije dio `test:e2e`. |

## Odakle referentne slike

Alat ih čita iz mape zadane u `DUCTURA_REFERENCES` i ne kopira ih. Danas su samo u repou Ductus (`docs/design/ductura/*-reference/snimke`). Hoće li se preseliti ovamo, odluka je vlasnika; do tada treba lokalni klon Ductusa.

Ekran bez referentne slike (nije zadana, nema datoteke ili `DUCTURA_REFERENCES` nije postavljen) u izvještaju piše „nema reference” i nema postotak.

## Poznate granice

- **Postotak nije prolaz ni pad.** Alat ne ruši ništa zbog razlike; odluku donosi osoba koja gleda slike.
- **Referentne slike su listovi sa svim stanjima ekrana**, a snimka je jedan ekran u jednom stanju. Zato su slike različite veličine i postotak je velik (danas 50 do 82 %). Koristan je red slika jedna do druge, ne broj. Broj će nešto značiti tek kad postoje reference izrezane po ekranu i stanju.
- **Koji ekran ide uz koju referencu** (`screens.ts`) upisano je prema README datotekama referentnih mapa; vlasnik to nije potvrdio.
- **Samo stanje „popunjeno”.** Prazno, učitavanje i greška se ne snimaju.
- **Samo Chromium na Linuxu**, kao i katalog.
- Alat ne dira osnovne snimke ni pragove kataloga.
