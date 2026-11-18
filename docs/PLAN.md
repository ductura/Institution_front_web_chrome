Kanonski plan migracije: [PLAN-MIGRACIJE.md](https://github.com/ductura/.github/blob/main/docs/plan/PLAN-MIGRACIJE.md). Ovaj dokument je dio tog plana.

# Ductura/web: plan repozitorija

Stanje: 14. 11. 2026. · **Samo plan.** Izvori kao u [plan servera](https://github.com/ductura/server/blob/main/docs/PLAN.md); Ductus `origin/main` 220b5db7.
**Odluka vlasnika 14. 11. (A1):** jedan web repo umjesto tri. Cilj je `ductura/web`, preimenovanjem postojećeg `web-chrome`. `web-mobile` i `web-other` arhiviraju se **nakon vlasnikove potvrde plana, ne sada**. Razlike preglednika i mobilni prikaz rješavaju se prilagodbom u istom kodu. Ovaj dokument zamjenjuje ranije zasebne planove za `web-chrome`, `web-mobile` i `web-other`. Uključene su i odluke A2, A3 i B1, B4, B5 (vidi [plan servera](https://github.com/ductura/server/blob/main/docs/PLAN.md)).

## 1. Svrha i granica

**Svrha.** Jedino web-sučelje za sve preglednike i uređaje: Chrome, Firefox, Safari, Edge i Opera na računalu te mobitel i tablet. Sadrži editor, rad bez veze, sinkronizaciju i sve radne ekrane (student, nastavnik, admin fakulteta, mrežni inženjer, podrška). Drži katalog komponenti (B5) i pakete `@ductura/ui`, `@ductura/editor-core` (od E-0.3) i `@ductura/parity`.

**Putanje (PRIJEDLOG, mijenja migraciju §1c):** jedna izgradnja na jednoj putanji (npr. `/app/`) umjesto `/c/`, `/m/`, `/o/`. Preloader više ne bira repo nego samo prikaz (računalo ili mobilno) i paket; konačnu putanju potvrđuje odluka 1 (usmjeravanje).

**Granica (nikad ne ulazi):**
- poslovna pravila i odluke o ovlastima (samo server; klijent samo prikazuje);
- izravno pisanje u tablice evidencije, predaje i revizijskog traga (samo API);
- serverske funkcije Next.js (statična izgradnja, `output: 'export'`);
- prepoznavanje okruženja na ulazu i stranice grešaka domene (preloader);
- grananje po nizu preglednika (UA): samo provjera mogućnosti;
- drugi način prijave osim AAI@EduHr (D-09); otisak preglednika.

## 2. Zatečeno stanje (kosturi, 14. 11.)

| Repo | Što ima | Što se uzima u `web` |
|---|---|---|
| `web-chrome` (postaje `web`) | statični JS (`dev-server.mjs`, `public/{app.js,lib/doc.js,…}`), unit `test/unit/doc.test.js`, e2e `editor-persists.spec.js` u pravom Chromeu (`channel: 'chrome'`) | repo, CI i scenarij „uređivanje preživi osvježavanje” |
| `web-mobile` | e2e `edit-with-keyboard.spec.js`; projekti Pixel 7, iPhone 14, iPad gen 7; popravak tipkovnice u WebKitu (`visualViewport`) | scenarij i projekti postaju dio matrice; repo arhiviran nakon potvrde |
| `web-other` | e2e `open-and-navigate.spec.js`; projekti `firefox`, `safari` (WebKit), `edge` (`msedge`), `opera-chromium` | scenarij i projekti u matricu; `opera-chromium` **nije prava Opera** (samo emulacija Chromea) i ne ulazi u matricu |

Nijedan kostur nije Next.js ni TypeScript, nema Tiptap ni dnevnik. Kostur se zamjenjuje (E-0.3, 2.c3 … 2.c6); tri postojeća e2e scenarija ostaju kao prvi testovi.

## 3. Sadržaj (PRIJEDLOG gdje plan ne navodi)

```
app/                    rad, zadaci, zadatak, nastavnik, ustanova, upis, stanje, postavke
src/components/         komponente po području (bez landing; to je preloader)
src/client/             klijentski moduli; pozivi samo kroz generirani klijent @ductura/contracts
src/domain/             klijentski dio domene (document, diff, citation, text, provenance, collaboration)
src/platform/           prilagodbe: mogućnosti preglednika, zaslonska tipkovnica, dodir, zamjene (2.c5)
src/i18n/               lokale (hr, en) i paritet ključeva
catalog/                katalog komponenti sa svim stanjima (B5)
packages/ui/  packages/editor-core/  packages/parity/
e2e/, tests/, docs/, .github/ (poziva ductura/.github)
```

## 4. Što dolazi iz Ductusa (prijenos s testovima, A2)

Kod koji radi i ima testove prenosi se **sa svojim testovima** kao dokazom jednakosti (izvorni SHA, isti broj testova, iste tvrdnje). Novo samo gdje ništa ne postoji.

| Izvor (Ductus) | Testovi koji idu s njim | Cilj | Zadatak |
|---|---|---|---|
| `src/editor` | 34 testa u `src/editor` (property, ekvivalencija, shema, unos) | `packages/editor-core` | E-0.1, E-0.2 (Ductus), E-0.3 |
| `src/lib/journal`, `src/lib/sync` | 17 + 4 testa (atomični dnevnik, odjava, drain, `evidence-test-kit`) | `packages/editor-core` | E-0.3 |
| `src/domain/sync`, `src/domain/serverSync` | 19 + 4 testa; `tests/unit/server-sync-messages.test.ts` | `packages/editor-core` (**PRIJEDLOG**; migracija §3 ih šalje kopijom, §2c traži „osam stanja” u paketu; vidi [KARTA](https://github.com/ductura/.github/blob/main/docs/plan/KARTA.md)) | E-0.3 |
| `src/domain/document` sa zatvorenjem uvoza koje treba shema (`src/domain/json.ts`, `src/domain/forensics/{jcs,crypto,integrity,ledger}.ts`) | 23 testa u `document` i izvorni testovi tog zatvorenja | `packages/editor-core` (odluka vlasnika, pristup B, Ductus#2028 c.6980945867) | DAN-888 |
| `src/domain/{diff,citation,text,provenance,collaboration}` | 3, 4, 1, 10 (`provenance`), 10 testova u tim mapama | `src/domain/` | 2.c4 |
| `src/client/*` | 18 testova u `src/client` | `src/client/`; `fetch` na rute Next.js zamjenjuje generirani klijent | 2.c3 |
| `src/components/*` bez `landing`, `how-it-works`, `auth` | testovi u tim mapama (npr. 20 `student`, 18 `teacher`, 19 `editor`, 17 `shell`, 12 `admin`) | `src/components/` | 2.c4 |
| `app/rad`, `zadaci`, `zadatak`, `nastavnik`, `ustanova`, `upis`, `stanje` | e2e u `e2e/login/*` za te stranice (npr. `student-workspace`, `teacher-home`, `institution-courses-page`, `submission`, `enroll-code`) | `app/` | 2.c4, 2.c6 |
| `src/lib/i18n` (sučelje) | `src/lib/i18n/*.test.ts`, `tests/property/interface-locale.property.test.ts` | `src/i18n/`, `packages/ui` | 2.c4 |
| oznake (`app/globals.css`, `app/fonts`, `src/components/shell/theme`) | `src/components/shell/tokens.test.ts` | `packages/ui` | 2.c1 |
| `e2e/*` bez landinga i prijave (`offline-editor`, `local-editor`, `evidence-journal`, `toolbar-menus`, `accessibility`, `visual` …) | sami su testovi; `e2e/support/*` harnessi | `e2e/` | 2.c6 |
| projekti `mobile` (Pixel 7), `firefox`, `webkit` iz `playwright.config.ts`; `.github/workflows/webkit-macos.yml` | — | matrica (§6) | 2.c6 |
| `scripts/forbidden-terms` | `tests/unit/forbidden-terms*.test.ts` | preko paketa iz servera ili kopija (PRIJEDLOG) | 2.c4 |

**Novo:** katalog komponenti (B5), `src/platform` (mobilni raspored, tipkovnica, dodir, zamjene za međuspremnik i pohranu), generirani klijent umjesto `fetch`.

## 5. Zadaci

**Ugovor prvi (A3):** web ovisi o ugovoru, ne o gotovom serveru. Svaki ekran se gradi nad lažnim serverom iz `@ductura/test-fakes` čim su shema i vektori rute objavljeni (server U4–U10). Pravi server dolazi u VS-1 i sistemskom e2e.

| ID / korak | Što | Ovisi o |
|---|---|---|
| 2.c1 | Popis komponenti **i katalog s vizualnim testovima** od prvog dana (B5) | `@ductura/ui` oznake |
| 2.c2 | Testovi komponenti (u katalogu: svako stanje, svaka širina) | 2.c1 |
| 2.c3 | Generirani klijent iz `@ductura/contracts` | server U10 |
| 2.c4 | Komponente i ekrani po području | 2.c3 i shema rute (ne gotov server) |
| 2.c5 | `src/platform`: prilagodbe mogućnosti, mobilni prikaz, tipkovnica, dodir, zamjene | 2.c4 |
| 2.c6 | e2e matrica (§6) | 2.c4 |
| 2.c7, 2.c8 | **spojeni u 2.c5 i 2.c6** (prije: mobilno i ostali preglednici u zasebnim repoima) | — |
| E-0.3 | `@ductura/editor-core` u `packages/editor-core` | VS-1, zamrzavanje Ductusa, 4 uvjeta migracije §2d |
| VS-1 | Vertikalni presjek preko pravog API-ja | S-1E-a, S-1D-d, S-1M-a, S-M-5, E-0.2, P-0.1 |
| VS-2 | Drugi presjek (mobilni prikaz u ovom repou) | VS-1; odluka 13 riješena odlukom A1 |

Koraci 2.c1 … 2.c9 nemaju ID (**PRIJEDLOG; ID dodjeljuje orkestrator u fazi 0.3**). 2.c9 (preuzimanje) je u preloaderu (P-0.9).
Područja za 2.c4 slijede serverske valove, ali čekaju samo shemu: račun i postavke (S-1J-*, S-1L.2, S-1L.3), dokumenti i rad (S-1D-*, S-M-*), predaja (S-1C.*), nastavnik i admin (S-1K.*), stanje (S-1M-*), pravno u aplikaciji (S-1N-*), uvoz (S-1G-*).

## 6. Testovi (editor, dnevnik, sinkronizacija, ekrani, svi preglednici)

**Dvojnici (iz `@ductura/test-fakes`, bez Dockera):** lažni server iz ugovora, lažni AAI@EduHr, lažni sat, lažne usluge `ok`/`slow`/`down`; `fake-indexeddb` za dnevnik; prekid veze kroz Playwright `offline`; odbijeno dopuštenje kroz `permissions`. Sistemski e2e nad pravim serverom (nativno, `preloader/e2e/system/`). Sintetički tekstovi.

| Sloj | Konkretni slučajevi |
|---|---|
| **Pomoćne funkcije** | shema dokumenta, diff, citati FPZG, brojanje; greške API-ja → poruke iz lokala; paritet `hr`/`en`; provjera mogućnosti vraća pravu zamjenu; izračun vidljivog prostora iz `visualViewport`; raspored po širini. |
| **Property (editor-core)** | izmjene i ponovna izgradnja daju isti dokument; dnevnik nakon prekida u bilo kojem trenutku daje zadnje potvrđeno stanje; nema SYNCED bez potpisane potvrde (F-3, F-8); replay provjerava hash obrisanog raspona (B-12); za bilo koju visinu tipkovnice kursor ostaje vidljiv. |
| **Integracija** | odjava briše dnevnik i zatvara stare kartice; ponovno spajanje prazni red; recovery, rebase, salvage; predaja samo kroz API; IndexedDB u privatnom načinu Firefoxa i Safarija daje upozorenje, ne tihi gubitak; međuspremnik bez dopuštenja. |
| **Ugovor** | generirani klijent pokreće sve vektore; nepoznato polje odbijeno; prikvačena verzija paketa; CI pada kad nova verzija ugovora lomi klijent. |
| **Katalog i vizualni (B5)** | svaka komponenta u katalogu u svim stanjima (prazno, učitavanje, greška, puno, onemogućeno); snimke na 1440, 1024, 768, 390 i 360 px, svjetla ljuska „papir i grafit” (D-188); usporedba s odobrenom snimkom pada na razlici iznad praga (vrijednost **otvoreno**); nova komponenta bez kataloga ruši test. |
| **e2e** | S-1H.8/1..6 (prijava, otvaranje rada, pisanje, rad bez veze, ponovno spajanje, predaja); nastavnik: kolegij, zadatak, pregled, komentar; admin fakulteta; tri postojeća scenarija iz kostura; prvi val §4: Chrome (spremi, osvježi, zamjena kad mogućnost fali), mobitel (tipkovnica, okretanje iPada), ostali (učitavanje, navigacija, međuspremnik, odbijeno dopuštenje). |
| **Paritet** | `@ductura/parity` S-1H.8/1..6 u svakom stupcu matrice. |
| **Pristupačnost** | WCAG 2.2 AA (Q-14): axe na svakoj stranici i u katalogu; tipkovnica u editoru; fokus nakon dijaloga; dodirne mete; uvećanje 200 %. |
| **Performanse** | tipkanje u dugom dokumentu (i uz usporeni CPU za mobilno); veliki diff po odlomcima; veličina paketa po stranici. |
| **Sigurnost** | nema tajni u izgradnji; CSP bez `unsafe-inline` (proxy); zabranjeni izrazi (PRODUCT §5); XSS kroz zalijepljeni sadržaj; `test-fakes` nije u produkcijskoj izgradnji. |

**Matrica (A1):** Chromium i pravi Chrome (`channel: 'chrome'`), Firefox, WebKit (Safari), Edge (`msedge`), mobilni viewport u emulaciji (Pixel 7, iPhone 14, iPad, iPad položeno). **Opera: ručna provjera** prije izdanja, zapis u PR-u. Safari na macOS-u noćno po uzoru na `webkit-macos.yml` (PRIJEDLOG). Pravi mobilni uređaji: odluka 9, **otvoreno** (trošak farme je vlasnička odluka).
**Prag „gotovo”:** S-1H.8/1..6 zeleni u svakom stupcu; katalog pokriva svaku komponentu; property testovi editor-corea zeleni; axe bez kršenja; ručni zapis za Operu.

## 7. CI i gate

- Poslovi (reusable iz `ductura/.github`): `lint`, `typecheck`, `unit`, `property`, `contracts`, `catalog-visual`, `e2e-chrome`, `e2e-firefox`, `e2e-webkit`, `e2e-edge`, `e2e-mobile`, `a11y`, `forbidden-terms`, `secret-scan`, `dependency-review`, `ci-ok`. Noćno `e2e-safari-macos`. Objava `@ductura/ui`, `@ductura/editor-core`, `@ductura/parity` na GitHub Packages (B1).
- Risk `critical`: `packages/editor-core/**`, odjava i lokalna pohrana, predaja, zamjene za pohranu, `.github/**` (PRIJEDLOG tablice, T-0.2).
- Vlasničke radnje: preimenovanje `web-chrome` → `web` i arhiviranje `web-mobile`, `web-other` nakon potvrde plana; V-2, V-3; odluka 1 (putanja); odluka 9.

## 8. Kriterij izlaza (prvi val)

1. VS-1 zelen kroz pravi proxy; E-0.3 gotov i Ductus zamrznut za editor.
2. S-1H.8/1..6 zeleni u Chromeu, Firefoxu, WebKitu, Edgeu i mobilnoj emulaciji; Opera ručno.
3. Ekrani za svaku objavljenu shemu postoje, prolaze katalog, axe i vizualnu usporedbu.
4. Preneseni testovi iz Ductusa prolaze s istim brojem i tvrdnjama.
5. `@ductura/ui`, `@ductura/editor-core` i `@ductura/parity` objavljeni.
