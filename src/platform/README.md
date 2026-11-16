# src/platform

Sloj prilagodbi preglednika (DAN-754, web 2.c5, `docs/PLAN.md` §3). Jedan kod za sve preglednike, mobitel i tablet; razlike se rješavaju provjerom mogućnosti, nikad nizom preglednika (UA).

- `capabilities.ts`: provjera mogućnosti i zamjene. Međuspremnik: Clipboard API, zatim `execCommand("copy")`, inače ključ upozorenja `workspace.earlierDraftCopyFailed`. Dopuštenja: `unknown` kad preglednik ne može reći. Nijedna funkcija ne baca.
- `viewport.ts`: vidljivi prostor iznad zaslonske tipkovnice iz `visualViewport` (popravak iz kostura `web-mobile`) i pomak koji drži kursor vidljivim.
- `layout.ts`: raspored po širini (iste granice kao `@media` u `@ductura/ui`) i dodirne mete (WCAG 2.2 AA, 24 px; dizajn 44 i 32 px).

Tekstovi upozorenja dolaze iz kataloga `locales/` kao ključevi; ovdje nema teksta sučelja. Scenariji u pravim preglednicima su u matrici 2.c6.
