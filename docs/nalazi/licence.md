# Licence ovisnosti, fontova i prototipa (F5-LICENCE `f5-licence`)

Datum: 26. 11. 2026. Pisac: `claude:wf5licence:frontend`. Nalog: orkestrator, Ductus#2058 (komentar 7182375922), odluka D8 (22. 11. 2026.). **Samo dokumentacija; kod se ne mijenja.**

Cilj: popis licenci svih ovisnosti (WEB, SRV, Preloader), fontova i prototipa; sve što nije permisivno označeno je **ZA POTVRDU** Danielu. Ovaj dokument nije pravno mišljenje; to je popis za Danielovu potvrdu.

## 1. Izvori i metoda

| Repo | Grana | SHA | Izvor popisa |
|---|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `d0defe91` | `pnpm-lock.yaml` |
| SRV `ductura/Institution_server` | `migracija/kopija-ductus-backend` | `0f5a3130` | `pnpm-lock.yaml` |
| Preloader `ductura/preloader` | `main` | `73d0462f` | `pnpm-lock.yaml` |

- Popis paketa (ime@verzija, uključujući tranzitivne) uzet je iz lockfilea; polje `license` za svaku točnu verziju dohvaćeno je iz npm registra (`registry.npmjs.org/<paket>/<verzija>`). Nije se instalirao nijedan paket i nisu čitane licencne datoteke u arhivama paketa.
- Polje `license` je ono što autor paketa deklarira. Za paket koji bi trebalo pravno ocijeniti treba otvoriti stvarni tekst licence; zato je to označeno „za potvrdu”.
- Permisivnim se ovdje smatra: MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, `(MIT OR CC0-1.0)`. Sve ostalo je ZA POTVRDU.
- Lockfile ne razlikuje što ulazi u isporučeni proizvod, a što je samo razvojni alat; ta razlika je u stupcu „Kamo ulazi” dolje, a procjena je moja (nije strojno provjerena) pa je i ona za potvrdu.
- Ograničenje: SRV baza u obzir uzima lockfile s migracijske grane, a ne `main` (`main` je 22. 11. imao stariji lockfile). `@ductura/contracts` je vlastiti paket (Ductura), ne vanjska ovisnost; njegova licenca nije u ovom popisu.

## 2. Sažetak: što treba Danielovu potvrdu

| # | Stavka | Licenca | Gdje | Kamo ulazi (procjena) | Zašto za potvrdu |
|---|---|---|---|---|---|
| 1 | `@img/sharp-libvips-*` (10 paketa), `@img/sharp-win32-*` (3), `@img/sharp-wasm32` (1) | LGPL-3.0-or-later (uz Apache-2.0 / MIT) | WEB | Opcionalna ovisnost produkcijskog paketa `next`. Isporučeni host `packages/app` koristi `next build` i `next start` (`.github/workflows/sistem.yml`, INT-10), pa se **ne može isključiti** da binarne datoteke ulaze u isporučeni artefakt. `next/image` se u kodu ne koristi, ali to samo po sebi ne dokazuje da se binarne datoteke ne distribuiraju. Distribucijski status je otvoren do provjere stvarnog artefakta. | LGPL: obveze pri distribuciji binarnih datoteka (obavijest, zamjenjivost biblioteke). |
| 2 | `lightningcss` (12 paketa) | MPL-2.0 | WEB, SRV, Preloader | Alat za gradnju (tranzitivno preko alata za gradnju i testove), ne ulazi u isporuku. | MPL-2.0: copyleft na razini datoteke; vrijedi samo ako se mijenjaju ili distribuiraju datoteke te biblioteke. |
| 3 | `axe-core`, `@axe-core/playwright` | MPL-2.0 | WEB, Preloader | Samo testovi dostupnosti (devDependencies). | Isto kao 2; ne isporučuje se. |
| 4 | `caniuse-lite` | CC-BY-4.0 | WEB | Podatkovna baza za alate (browserslist), ne ulazi u isporuku. | CC-BY traži imenovanje ako se distribuira. |
| 5 | Hrvatski Hunspell rječnik `public/dictionaries/hr/` (`hr.aff`, `hr.dic`) | „LGPL/SISSL license, 2003” (autor Denis Lackovic, OpenOffice rječnik) | WEB (isporučuje se kao statička datoteka) | **Isporučuje se korisniku.** | Dvostruka licenca LGPL/SISSL s neprecizno navedenom verzijom; treba odabrati licencu i ispuniti obveze (tekst licence uz rječnik, izvor). Najvažnija stavka na popisu. |
| 6 | Font za disleksiju | nije odabran | WEB `packages/ui/src/fonts/dyslexia/` | Datoteka fonta nije uključena | Vlasnik još bira font (val20-razlika §2.1, §5); prije uključivanja potvrditi licencu (OFL preporuka). |
| 7 | Prototip: Google Fonts preko `fonts.googleapis.com` | Fontovi su OFL (vidi §4), ali učitavanje s Googleovih poslužitelja šalje IP korisnika trećoj strani | `docs/prototip/*.html` | Samo dokumentacija; aplikacija koristi lokalne kopije | Ako se prototip ikad objavi izvan repoa, privatnost/GDPR; za aplikaciju nije problem. |
| 8 | Prototip: neuključeni vendor (`vendor/tiptap.js`, KaTeX 0.19.1, pdf.js 3.11.174, `spell.js` s hunspell-asm i nspell) | MIT / MIT / Apache-2.0 / MIT (po npm registru) | `docs/prototip/` (datoteke vendor nisu u repou, samo naziv i verzija u INVENTAR-editor §Vendor) | Samo dokumentacija | Nije provjerena stvarna datoteka, nego deklaracija upstreama; informativno. |

Što **nije** pronađeno: nijedan paket s licencom GPL, AGPL, SSPL, „NONE”/bez licence ni „UNLICENSED”. Svi ostali paketi su permisivni (vidi tablice dolje).

## 3. Ovisnosti po repou

Brojke su jedinstveni parovi paket@verzija u lockfileu. Puni popis po paketu je u Dodatku A.

### WEB: zbroj po licenci (272 paketa u lockfileu)

| Licenca | Broj paketa | Skupina |
|---|---:|---|
| MIT | 202 | permisivna |
| Apache-2.0 | 25 | permisivna |
| MPL-2.0 | 14 | **ZA POTVRDU** (slabi copyleft, MPL-2.0) |
| LGPL-3.0-or-later | 10 | **ZA POTVRDU** (LGPL) |
| ISC | 8 | permisivna |
| Apache-2.0 AND LGPL-3.0-or-later | 3 | **ZA POTVRDU** (LGPL) |
| BSD-3-Clause | 3 | permisivna |
| BSD-2-Clause | 2 | permisivna |
| 0BSD | 2 | permisivna |
| MIT-0 | 1 | permisivna |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 | **ZA POTVRDU** (LGPL) |
| CC-BY-4.0 | 1 | **ZA POTVRDU** (nije permisivna) |

Paketi koji nisu permisivni (varijante po platformi skupljene):

| Paket (obitelj) | Licenca | Točnih paketa u lockfileu |
|---|---|---:|
| @axe-core/playwright | MPL-2.0 | 1 (@axe-core/playwright@4.13.0) |
| @img/sharp-libvips | LGPL-3.0-or-later | 10 (@img/sharp-libvips-darwin-arm64@1.3.4, …) |
| @img/sharp | Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 (@img/sharp-wasm32@0.35.5) |
| @img/sharp | Apache-2.0 AND LGPL-3.0-or-later | 3 (@img/sharp-win32-arm64@0.35.5, …) |
| axe-core | MPL-2.0 | 1 (axe-core@4.13.0) |
| caniuse-lite | CC-BY-4.0 | 1 (caniuse-lite@1.0.30001826) |
| lightningcss | MPL-2.0 | 12 (lightningcss@1.33.0, …) |

### SRV: zbroj po licenci (376 paketa u lockfileu)

| Licenca | Broj paketa | Skupina |
|---|---:|---|
| MIT | 299 | permisivna |
| Apache-2.0 | 42 | permisivna |
| MPL-2.0 | 12 | **ZA POTVRDU** (slabi copyleft, MPL-2.0) |
| ISC | 11 | permisivna |
| BSD-2-Clause | 6 | permisivna |
| BlueOak-1.0.0 | 2 | permisivna |
| BSD-3-Clause | 2 | permisivna |
| 0BSD | 1 | permisivna |
| (MIT OR CC0-1.0) | 1 | permisivna |

Paketi koji nisu permisivni (varijante po platformi skupljene):

| Paket (obitelj) | Licenca | Točnih paketa u lockfileu |
|---|---|---:|
| lightningcss | MPL-2.0 | 12 (lightningcss@1.33.0, …) |

### Preloader: zbroj po licenci (117 paketa u lockfileu)

| Licenca | Broj paketa | Skupina |
|---|---:|---|
| MIT | 91 | permisivna |
| MPL-2.0 | 14 | **ZA POTVRDU** (slabi copyleft, MPL-2.0) |
| Apache-2.0 | 6 | permisivna |
| BSD-3-Clause | 2 | permisivna |
| ISC | 2 | permisivna |
| BSD-2-Clause | 1 | permisivna |
| 0BSD | 1 | permisivna |

Paketi koji nisu permisivni (varijante po platformi skupljene):

| Paket (obitelj) | Licenca | Točnih paketa u lockfileu |
|---|---|---:|
| @axe-core/playwright | MPL-2.0 | 1 (@axe-core/playwright@4.14.0) |
| axe-core | MPL-2.0 | 1 (axe-core@4.14.1) |
| lightningcss | MPL-2.0 | 12 (lightningcss@1.33.0, …) |

### Izravne ovisnosti koje se isporučuju (WEB)

Iz `package.json` datoteka u WEB repou (`packages/app`, `packages/editor-core`, `src/components`, korijen). Sve su permisivne.

| Paket | Verzija | Licenca |
|---|---|---|
| next | 16.4.6 | MIT |
| react, react-dom | 19.3.1 | MIT |
| @tiptap/core, @tiptap/pm, @tiptap/extension-* | 3.33.0 | MIT |
| dexie | 4.4.7 | Apache-2.0 |
| highlight.js | 11.11.1 | BSD-3-Clause |
| katex | 0.16.22 (`packages/app`), katex u `src/components` | MIT |
| pdfjs-dist, hunspell-asm | vidi lockfile | Apache-2.0, MIT |

### Izravne ovisnosti koje se isporučuju (SRV)

| Paket | Verzija | Licenca |
|---|---|---|
| @aws-sdk/client-kms | 3.1155.0 | Apache-2.0 |
| @sinclair/typebox | 0.34.52 | MIT |
| openid-client | 6.8.8 | MIT |
| pg | 8.23.1 | MIT |
| pg-boss | 12.38.0 | MIT |

Razvojne ovisnosti SRV-a (eslint, vitest, typescript, esbuild, oidc-provider, dbmate i dr.) su permisivne osim tranzitivnog `lightningcss` (MPL-2.0, vidi §2).

### Preloader

Isporučuje se statički sloj izgrađen esbuildom iz vlastitog koda; `package.json` ima samo devDependencies (`@playwright/test`, `@axe-core/playwright`, `vitest`, `happy-dom`, `ajv`, `esbuild`, `fast-check`, `typescript`, `yaml`, `@ductura/contracts`). Nijedna se ne isporučuje korisniku; nepermisivne su samo `axe-core`, `@axe-core/playwright` i `lightningcss` (MPL-2.0, samo alati).

## 4. Fontovi

Tri porodice sučelja, lokalne kopije bez CDN-a, `packages/ui/src/fonts/` (izvor, verzije i SHA-256 u `SOURCE.md`). Tekstovi licenci su uz fontove (`OFL-*.txt`).

| Font | Verzija | Licenca | Datoteka licence | Status |
|---|---|---|---|---|
| Instrument Sans | Google Fonts v4 | SIL OFL 1.1, bez Reserved Font Name | `OFL-InstrumentSans.txt` | permisivna, uz obvezu da se tekst licence čuva uz font |
| Newsreader | v26 | SIL OFL 1.1, bez Reserved Font Name | `OFL-Newsreader.txt` | isto |
| JetBrains Mono | v24 | SIL OFL 1.1, bez Reserved Font Name | `OFL-JetBrainsMono.txt` | isto |
| Font za disleksiju | nema | nije odabran | nema | **ZA POTVRDU** (§2, stavka 6) |

Napomene:
- OFL 1.1 dopušta ugradnju i distribuciju uz fontove; ne smije se prodavati sam font i izvedeni fontovi ostaju pod OFL. Aplikacija ugrađuje nepromijenjene WOFF2 datoteke.
- Isti fontovi postoje i u starom Next kodu `src/app/fonts/` (bez datoteka licenci u toj mapi); mapa je naslijeđena i ne dira se (§Gdje živi aplikacija). Ako se ikad isporučuje, treba dodati OFL tekstove ili ukloniti mapu.
- KaTeX donosi vlastite fontove (KaTeX fontovi su pod licencom OFL, a paket pod MIT); nije provjereno u stvarnom paketu, za potvrdu pri isporuci.

## 5. Prototipi

| Stavka | Gdje | Što sadrži | Licenčna procjena |
|---|---|---|---|
| Ductura_student / nastavnik / administracija (+ `_kartice`) | `docs/prototip/*.html` | Vlastiti HTML/CSS/JS Ductura; učitava Google Fonts (Instrument Sans, JetBrains Mono, Newsreader) | Vlastiti kod; fontovi OFL, ali se učitavaju s `fonts.googleapis.com` (§2, stavka 7). |
| Prototip editora | `docs/prototip/editor/` (`*.js`, `editor.css`, `rules/unizg.json`) | Vlastiti kod; `vendor/` (Tiptap, KaTeX, pdf.js, spell.js, rječnik hr) naveden u INVENTAR-editor, ali datoteke nisu u repou | Vlastiti kod; vendor po npm deklaraciji MIT/MIT/Apache-2.0/MIT (§2, stavka 8). `rules/unizg.json`: izvor i licencu podataka pravila treba potvrditi (vlasnik). |
| Hrvatski rječnik prototipa | `hr-aff.txt`, `hr-dic.txt` (INVENTAR-editor) | Isti rječnik kao `public/dictionaries/hr` | Isto kao §2, stavka 5. |
| Snimke zaslona | `docs/snimke/`, `catalog/e2e/*-snapshots/` | Generirane snimke vlastitog sučelja (Playwright) | Vlastiti sadržaj; ne sadrže tuđe osobne podatke jer su izmišljeni. |

## 6. Prijedlog odluke za Daniela

1. **Hrvatski rječnik (stavka 5)**: odabrati koja se licenca primjenjuje (LGPL ili SISSL), dodati cijeli tekst licence uz `public/dictionaries/hr/` i oznaku izvora (OpenOffice, Denis Lackovic). Do odluke je to jedina ovisnost koja se stvarno isporučuje korisniku, a nije jasno permisivna.
2. **LGPL `sharp-libvips` (stavka 1)**: ostaje otvoreno. Host je Next, a `sharp` je opcionalna ovisnost `next`; provjeriti stvarni isporučeni artefakt (sadrži li `@img/sharp-libvips-*`) i tek tada odlučiti o LGPL obvezama (obavijest, zamjenjivost). `next/image` se ne koristi, ali to nije dokaz da biblioteke nisu u isporuci.
3. **MPL-2.0 alati (stavke 2, 3)**: prihvatiti kao alate bez distribucije (bez izmjene izvornog koda biblioteka).
4. **`caniuse-lite` (stavka 4)**: prihvatiti kao alat bez distribucije.
5. **Font za disleksiju (stavka 6)** i **izvor pravila `unizg.json` (§5)**: čekaju odluku vlasnika.

## Dodatak A: puni popis (paket, verzija, licenca)

Izvor: lockfileovi iz §1; licence iz npm registra.

### WEB

| Paket | Verzija | Licenca |
|---|---|---|
| @asamuzakjp/css-color | 3.2.0 | MIT |
| @axe-core/playwright | 4.13.0 | MPL-2.0 |
| @csstools/color-helpers | 5.1.0 | MIT-0 |
| @csstools/css-calc | 2.1.4 | MIT |
| @csstools/css-color-parser | 3.1.0 | MIT |
| @csstools/css-parser-algorithms | 3.0.5 | MIT |
| @csstools/css-tokenizer | 3.0.4 | MIT |
| @emnapi/core | 2.0.0-beta.2 | MIT |
| @emnapi/runtime | 2.0.0-beta.2 | MIT |
| @emnapi/runtime | 1.11.3 | MIT |
| @emnapi/wasi-threads | 2.2.0 | MIT |
| @fast-check/vitest | 0.5.0 | MIT |
| @floating-ui/core | 1.8.0 | MIT |
| @floating-ui/dom | 1.8.0 | MIT |
| @floating-ui/utils | 0.2.12 | MIT |
| @img/colour | 1.1.0 | MIT |
| @img/sharp-darwin-arm64 | 0.35.5 | Apache-2.0 |
| @img/sharp-darwin-x64 | 0.35.5 | Apache-2.0 |
| @img/sharp-freebsd-wasm32 | 0.35.5 | Apache-2.0 |
| @img/sharp-libvips-darwin-arm64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-darwin-x64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-arm | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-arm64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-ppc64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-riscv64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-s390x | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linux-x64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linuxmusl-arm64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-libvips-linuxmusl-x64 | 1.3.4 | LGPL-3.0-or-later |
| @img/sharp-linux-arm | 0.35.5 | Apache-2.0 |
| @img/sharp-linux-arm64 | 0.35.5 | Apache-2.0 |
| @img/sharp-linux-ppc64 | 0.35.5 | Apache-2.0 |
| @img/sharp-linux-riscv64 | 0.35.5 | Apache-2.0 |
| @img/sharp-linux-s390x | 0.35.5 | Apache-2.0 |
| @img/sharp-linux-x64 | 0.35.5 | Apache-2.0 |
| @img/sharp-linuxmusl-arm64 | 0.35.5 | Apache-2.0 |
| @img/sharp-linuxmusl-x64 | 0.35.5 | Apache-2.0 |
| @img/sharp-wasm32 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later AND MIT |
| @img/sharp-webcontainers-wasm32 | 0.35.5 | Apache-2.0 |
| @img/sharp-win32-arm64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @img/sharp-win32-ia32 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @jridgewell/resolve-uri | 3.1.3 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @napi-rs/canvas | 0.1.100 | MIT |
| @napi-rs/canvas-android-arm64 | 0.1.100 | MIT |
| @napi-rs/canvas-darwin-arm64 | 0.1.100 | MIT |
| @napi-rs/canvas-darwin-x64 | 0.1.100 | MIT |
| @napi-rs/canvas-linux-arm-gnueabihf | 0.1.100 | MIT |
| @napi-rs/canvas-linux-arm64-gnu | 0.1.100 | MIT |
| @napi-rs/canvas-linux-arm64-musl | 0.1.100 | MIT |
| @napi-rs/canvas-linux-riscv64-gnu | 0.1.100 | MIT |
| @napi-rs/canvas-linux-x64-gnu | 0.1.100 | MIT |
| @napi-rs/canvas-linux-x64-musl | 0.1.100 | MIT |
| @napi-rs/canvas-win32-arm64-msvc | 0.1.100 | MIT |
| @napi-rs/canvas-win32-x64-msvc | 0.1.100 | MIT |
| @napi-rs/wasm-runtime | 1.2.6 | MIT |
| @next/env | 16.4.6 | MIT |
| @next/swc-darwin-arm64 | 16.4.6 | MIT |
| @next/swc-darwin-x64 | 16.4.6 | MIT |
| @next/swc-linux-arm64-gnu | 16.4.6 | MIT |
| @next/swc-linux-arm64-musl | 16.4.6 | MIT |
| @next/swc-linux-x64-gnu | 16.4.6 | MIT |
| @next/swc-linux-x64-musl | 16.4.6 | MIT |
| @next/swc-win32-arm64-msvc | 16.4.6 | MIT |
| @next/swc-win32-x64-msvc | 16.4.6 | MIT |
| @oxc-project/types | 0.156.0 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| @rolldown/binding-android-arm-eabi | 1.2.19 | MIT |
| @rolldown/binding-android-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-x64 | 1.2.19 | MIT |
| @rolldown/binding-freebsd-x64 | 1.2.19 | MIT |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-musl | 1.2.19 | MIT |
| @rolldown/binding-linux-ppc64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-s390x-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-musl | 1.2.19 | MIT |
| @rolldown/binding-openharmony-arm64 | 1.2.19 | MIT |
| @rolldown/binding-wasm32-wasi | 1.2.19 | MIT |
| @rolldown/binding-win32-arm64-msvc | 1.2.19 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.19 | MIT |
| @rolldown/pluginutils | 1.1.1 | MIT |
| @swc/helpers | 0.5.23 | Apache-2.0 |
| @tiptap/core | 3.33.0 | MIT |
| @tiptap/extension-bold | 3.33.0 | MIT |
| @tiptap/extension-bubble-menu | 3.33.0 | MIT |
| @tiptap/extension-document | 3.33.0 | MIT |
| @tiptap/extension-floating-menu | 3.33.0 | MIT |
| @tiptap/extension-heading | 3.33.0 | MIT |
| @tiptap/extension-history | 3.33.0 | MIT |
| @tiptap/extension-italic | 3.33.0 | MIT |
| @tiptap/extension-paragraph | 3.33.0 | MIT |
| @tiptap/extension-placeholder | 3.33.0 | MIT |
| @tiptap/extension-text | 3.33.0 | MIT |
| @tiptap/extensions | 3.33.0 | MIT |
| @tiptap/pm | 3.33.0 | MIT |
| @tiptap/react | 3.33.0 | MIT |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/chai | 5.2.3 | MIT |
| @types/deep-eql | 4.0.2 | MIT |
| @types/estree | 1.0.10 | MIT |
| @types/katex | 0.16.8 | MIT |
| @types/node | 26.6.4 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @types/use-sync-external-store | 0.0.6 | MIT |
| @vitest/mocker | 5.0.3 | MIT |
| @vitest/spy | 5.0.3 | MIT |
| accepts | 1.3.8 | MIT |
| agent-base | 7.1.4 | MIT |
| assertion-error | 2.0.1 | MIT |
| axe-core | 4.13.0 | MPL-2.0 |
| baseline-browser-mapping | 2.11.38 | Apache-2.0 |
| caniuse-lite | 1.0.30001826 | CC-BY-4.0 |
| chai | 6.3.0 | MIT |
| client-only | 0.0.1 | MIT |
| commander | 8.3.0 | MIT |
| content-disposition | 1.0.1 | MIT |
| content-type | 1.0.5 | MIT |
| content-type | 2.1.0 | MIT |
| cookies | 0.9.2 | MIT |
| cssstyle | 4.6.0 | MIT |
| csstype | 3.2.3 | MIT |
| data-urls | 5.0.0 | MIT |
| debug | 4.4.3 | MIT |
| decimal.js | 10.6.0 | MIT |
| deep-equal | 1.0.1 | MIT |
| delegates | 1.0.0 | MIT |
| depd | 1.1.2 | MIT |
| depd | 2.0.0 | MIT |
| destroy | 1.2.0 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| dexie | 4.4.7 | Apache-2.0 |
| ee-first | 1.1.1 | MIT |
| emscripten-wasm-loader | 3.0.3 | MIT |
| encodeurl | 2.0.3 | MIT |
| entities | 6.0.1 | BSD-2-Clause |
| es-module-lexer | 2.3.2 | MIT |
| escape-html | 1.0.3 | MIT |
| estree-walker | 3.0.3 | MIT |
| expect-type | 1.4.0 | Apache-2.0 |
| fake-indexeddb | 6.2.8 | Apache-2.0 |
| fast-check | 4.10.2 | MIT |
| fast-equals | 5.4.5 | MIT |
| fdir | 6.5.0 | MIT |
| fresh | 0.5.2 | MIT |
| fsevents | 2.3.3 | MIT |
| getroot | 1.0.0 | MIT |
| highlight.js | 11.11.1 | BSD-3-Clause |
| html-encoding-sniffer | 4.0.0 | MIT |
| http-assert | 1.5.0 | MIT |
| http-errors | 1.8.1 | MIT |
| http-errors | 2.0.1 | MIT |
| http-proxy-agent | 7.0.2 | MIT |
| https-proxy-agent | 7.0.6 | MIT |
| hunspell-asm | 4.0.2 | MIT |
| iconv-lite | 0.6.3 | MIT |
| inherits | 2.0.4 | ISC |
| is-potential-custom-element-name | 1.0.1 | MIT |
| jose | 6.2.18 | MIT |
| jsdom | 26.1.0 | MIT |
| katex | 0.16.22 | MIT |
| keygrip | 1.1.0 | MIT |
| koa | 3.3.0 | MIT |
| koa-compose | 4.1.0 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-android-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-freebsd-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-win32-arm64-msvc | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| lru-cache | 10.4.3 | ISC |
| magic-string | 1.4.5 | MIT |
| media-typer | 1.1.1 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-db | 1.54.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mime-types | 3.0.2 | MIT |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.20 | MIT |
| nanoid | 2.1.11 | MIT |
| negotiator | 0.6.3 | MIT |
| next | 16.4.6 | MIT |
| node-readable-to-web-readable-stream | 0.4.2 | MIT |
| normalize-path | 2.1.1 | MIT |
| nwsapi | 2.2.28 | MIT |
| obug | 2.2.1 | MIT |
| oidc-provider | 9.12.2 | MIT |
| on-finished | 2.4.2 | MIT |
| orderedmap | 2.1.1 | MIT |
| parse5 | 7.3.0 | MIT |
| parseurl | 1.3.3 | MIT |
| pdfjs-dist | 5.4.624 | Apache-2.0 |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| playwright | 1.63.0 | Apache-2.0 |
| playwright-core | 1.63.0 | Apache-2.0 |
| postcss | 8.5.33 | MIT |
| postcss | 8.5.23 | MIT |
| prosemirror-changeset | 2.4.6 | MIT |
| prosemirror-commands | 1.7.2 | MIT |
| prosemirror-dropcursor | 1.8.4 | MIT |
| prosemirror-gapcursor | 1.4.1 | MIT |
| prosemirror-history | 1.5.1 | MIT |
| prosemirror-inputrules | 1.6.0 | MIT |
| prosemirror-keymap | 1.2.3 | MIT |
| prosemirror-model | 1.25.13 | MIT |
| prosemirror-schema-list | 1.6.0 | MIT |
| prosemirror-state | 1.4.4 | MIT |
| prosemirror-tables | 1.8.5 | MIT |
| prosemirror-transform | 1.12.6 | MIT |
| prosemirror-view | 1.42.9 | MIT |
| punycode | 2.3.1 | MIT |
| pure-rand | 8.4.2 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| remove-trailing-separator | 1.1.0 | ISC |
| rolldown | 1.2.19 | MIT |
| rope-sequence | 1.3.4 | MIT |
| rrweb-cssom | 0.8.0 | MIT |
| safer-buffer | 2.1.2 | MIT |
| saxes | 6.0.0 | ISC |
| scheduler | 0.28.0 | MIT |
| semver | 7.8.6 | ISC |
| setprototypeof | 1.2.0 | ISC |
| sharp | 0.35.5 | Apache-2.0 |
| source-map-js | 1.2.2 | BSD-3-Clause |
| statuses | 1.5.0 | MIT |
| statuses | 2.0.2 | MIT |
| std-env | 4.3.0 | MIT |
| styled-jsx | 5.1.6 | MIT |
| symbol-tree | 3.2.4 | MIT |
| tinybench | 6.2.3 | MIT |
| tinyexec | 1.3.1 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tldts | 6.1.86 | MIT |
| tldts-core | 6.1.86 | MIT |
| toidentifier | 1.0.1 | MIT |
| tough-cookie | 5.1.2 | BSD-3-Clause |
| tr46 | 5.1.1 | MIT |
| tslib | 2.9.1 | 0BSD |
| tslib | 1.14.1 | 0BSD |
| tsscmp | 1.0.6 | MIT |
| type-is | 2.1.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| undici-types | 8.9.0 | MIT |
| unixify | 1.0.0 | MIT |
| use-sync-external-store | 1.7.0 | MIT |
| vary | 1.1.2 | MIT |
| vite | 8.3.3 | MIT |
| vitest | 5.0.3 | MIT |
| w3c-keyname | 2.2.8 | MIT |
| w3c-xmlserializer | 5.0.0 | MIT |
| webidl-conversions | 7.0.0 | BSD-2-Clause |
| whatwg-encoding | 3.1.1 | MIT |
| whatwg-mimetype | 4.0.0 | MIT |
| whatwg-url | 14.2.0 | MIT |
| why-is-node-running | 3.2.1 | MIT |
| ws | 8.23.0 | MIT |
| xml-name-validator | 5.0.0 | Apache-2.0 |
| xmlchars | 2.2.0 | MIT |
| yaml | 2.9.1 | ISC |

### SRV

| Paket | Verzija | Licenca |
|---|---|---|
| @aws-sdk/client-kms | 3.1155.0 | Apache-2.0 |
| @aws-sdk/core | 3.981.0 | Apache-2.0 |
| @aws-sdk/credential-provider-env | 3.972.84 | Apache-2.0 |
| @aws-sdk/credential-provider-http | 3.972.86 | Apache-2.0 |
| @aws-sdk/credential-provider-ini | 3.973.30 | Apache-2.0 |
| @aws-sdk/credential-provider-login | 3.972.92 | Apache-2.0 |
| @aws-sdk/credential-provider-node | 3.972.97 | Apache-2.0 |
| @aws-sdk/credential-provider-process | 3.972.84 | Apache-2.0 |
| @aws-sdk/credential-provider-sso | 3.973.28 | Apache-2.0 |
| @aws-sdk/credential-provider-web-identity | 3.972.90 | Apache-2.0 |
| @aws-sdk/nested-clients | 3.998.3 | Apache-2.0 |
| @aws-sdk/signature-v4-multi-region | 3.996.52 | Apache-2.0 |
| @aws-sdk/token-providers | 3.1166.0 | Apache-2.0 |
| @aws-sdk/types | 3.975.1 | Apache-2.0 |
| @aws-sdk/xml-builder | 3.972.43 | Apache-2.0 |
| @aws/lambda-invoke-store | 0.3.0 | Apache-2.0 |
| @cacheable/memory | 2.2.0 | MIT |
| @cacheable/utils | 2.5.0 | MIT |
| @cantoo/fontkit | 2.0.12 | MIT |
| @cantoo/pdf-lib | 2.11.1 | MIT |
| @dbmate/darwin-arm64 | 2.36.0 | MIT |
| @dbmate/darwin-x64 | 2.36.0 | MIT |
| @dbmate/linux-arm | 2.36.0 | MIT |
| @dbmate/linux-arm64 | 2.36.0 | MIT |
| @dbmate/linux-ia32 | 2.36.0 | MIT |
| @dbmate/linux-x64 | 2.36.0 | MIT |
| @dbmate/win32-x64 | 2.36.0 | MIT |
| @electric-sql/pglite | 0.3.14 | Apache-2.0 |
| @emnapi/core | 2.0.0-beta.2 | MIT |
| @emnapi/runtime | 2.0.0-beta.2 | MIT |
| @emnapi/wasi-threads | 2.2.0 | MIT |
| @esbuild/aix-ppc64 | 0.28.2 | MIT |
| @esbuild/android-arm | 0.28.2 | MIT |
| @esbuild/android-arm64 | 0.28.2 | MIT |
| @esbuild/android-x64 | 0.28.2 | MIT |
| @esbuild/darwin-arm64 | 0.28.2 | MIT |
| @esbuild/darwin-x64 | 0.28.2 | MIT |
| @esbuild/freebsd-arm64 | 0.28.2 | MIT |
| @esbuild/freebsd-x64 | 0.28.2 | MIT |
| @esbuild/linux-arm | 0.28.2 | MIT |
| @esbuild/linux-arm64 | 0.28.2 | MIT |
| @esbuild/linux-ia32 | 0.28.2 | MIT |
| @esbuild/linux-loong64 | 0.28.2 | MIT |
| @esbuild/linux-mips64el | 0.28.2 | MIT |
| @esbuild/linux-ppc64 | 0.28.2 | MIT |
| @esbuild/linux-riscv64 | 0.28.2 | MIT |
| @esbuild/linux-s390x | 0.28.2 | MIT |
| @esbuild/linux-x64 | 0.28.2 | MIT |
| @esbuild/netbsd-arm64 | 0.28.2 | MIT |
| @esbuild/netbsd-x64 | 0.28.2 | MIT |
| @esbuild/openbsd-arm64 | 0.28.2 | MIT |
| @esbuild/openbsd-x64 | 0.28.2 | MIT |
| @esbuild/openharmony-arm64 | 0.28.2 | MIT |
| @esbuild/sunos-x64 | 0.28.2 | MIT |
| @esbuild/win32-arm64 | 0.28.2 | MIT |
| @esbuild/win32-ia32 | 0.28.2 | MIT |
| @esbuild/win32-x64 | 0.28.2 | MIT |
| @eslint-community/eslint-utils | 4.10.1 | MIT |
| @eslint-community/regexpp | 4.12.3 | MIT |
| @eslint/config-array | 0.23.6 | Apache-2.0 |
| @eslint/config-helpers | 0.7.0 | Apache-2.0 |
| @eslint/core | 1.2.1 | Apache-2.0 |
| @eslint/object-schema | 3.0.5 | Apache-2.0 |
| @eslint/plugin-kit | 0.7.3 | Apache-2.0 |
| @fast-check/vitest | 0.5.0 | MIT |
| @humanfs/core | 0.19.2 | Apache-2.0 |
| @humanfs/node | 0.16.8 | Apache-2.0 |
| @humanfs/types | 0.15.0 | Apache-2.0 |
| @humanwhocodes/module-importer | 1.0.1 | Apache-2.0 |
| @humanwhocodes/retry | 0.4.3 | Apache-2.0 |
| @isaacs/nonrecursive-glob-match | 1.1.0 | BlueOak-1.0.0 |
| @jridgewell/resolve-uri | 3.1.3 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @keyv/bigmap | 1.3.1 | MIT |
| @keyv/serialize | 1.1.1 | MIT |
| @napi-rs/canvas | 1.2.0 | MIT |
| @napi-rs/canvas-android-arm64 | 1.2.0 | MIT |
| @napi-rs/canvas-darwin-arm64 | 1.2.0 | MIT |
| @napi-rs/canvas-darwin-x64 | 1.2.0 | MIT |
| @napi-rs/canvas-linux-arm-gnueabihf | 1.2.0 | MIT |
| @napi-rs/canvas-linux-arm64-gnu | 1.2.0 | MIT |
| @napi-rs/canvas-linux-arm64-musl | 1.2.0 | MIT |
| @napi-rs/canvas-linux-riscv64-gnu | 1.2.0 | MIT |
| @napi-rs/canvas-linux-x64-gnu | 1.2.0 | MIT |
| @napi-rs/canvas-linux-x64-musl | 1.2.0 | MIT |
| @napi-rs/canvas-win32-arm64-msvc | 1.2.0 | MIT |
| @napi-rs/canvas-win32-x64-msvc | 1.2.0 | MIT |
| @napi-rs/wasm-runtime | 1.2.6 | MIT |
| @opentelemetry/api | 1.10.0 | Apache-2.0 |
| @oxc-project/types | 0.156.0 | MIT |
| @rolldown/binding-android-arm-eabi | 1.2.19 | MIT |
| @rolldown/binding-android-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-x64 | 1.2.19 | MIT |
| @rolldown/binding-freebsd-x64 | 1.2.19 | MIT |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-musl | 1.2.19 | MIT |
| @rolldown/binding-linux-ppc64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-s390x-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-musl | 1.2.19 | MIT |
| @rolldown/binding-openharmony-arm64 | 1.2.19 | MIT |
| @rolldown/binding-wasm32-wasi | 1.2.19 | MIT |
| @rolldown/binding-win32-arm64-msvc | 1.2.19 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.19 | MIT |
| @rolldown/pluginutils | 1.1.1 | MIT |
| @sinclair/typebox | 0.34.52 | MIT |
| @smithy/core | 3.40.0 | Apache-2.0 |
| @smithy/credential-provider-imds | 4.5.2 | Apache-2.0 |
| @smithy/fetch-http-handler | 5.8.1 | Apache-2.0 |
| @smithy/node-http-handler | 4.14.2 | Apache-2.0 |
| @smithy/signature-v4 | 5.7.4 | Apache-2.0 |
| @smithy/signature-v4 | 5.7.5 | Apache-2.0 |
| @smithy/types | 4.20.0 | Apache-2.0 |
| @tiptap/core | 3.33.0 | MIT |
| @tiptap/extension-bold | 3.33.0 | MIT |
| @tiptap/extension-document | 3.33.0 | MIT |
| @tiptap/extension-heading | 3.33.0 | MIT |
| @tiptap/extension-history | 3.33.0 | MIT |
| @tiptap/extension-italic | 3.33.0 | MIT |
| @tiptap/extension-paragraph | 3.33.0 | MIT |
| @tiptap/extension-placeholder | 3.33.0 | MIT |
| @tiptap/extension-text | 3.33.0 | MIT |
| @tiptap/extensions | 3.33.0 | MIT |
| @tiptap/pm | 3.33.0 | MIT |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/accepts | 1.3.7 | MIT |
| @types/body-parser | 1.19.6 | MIT |
| @types/chai | 5.2.3 | MIT |
| @types/connect | 3.4.38 | MIT |
| @types/content-disposition | 0.5.9 | MIT |
| @types/cookies | 0.9.2 | MIT |
| @types/deep-eql | 4.0.2 | MIT |
| @types/esrecurse | 4.3.1 | MIT |
| @types/estree | 1.0.10 | MIT |
| @types/express | 5.0.6 | MIT |
| @types/express-serve-static-core | 5.1.3 | MIT |
| @types/http-assert | 1.5.6 | MIT |
| @types/http-errors | 2.0.5 | MIT |
| @types/json-schema | 7.0.15 | MIT |
| @types/keygrip | 1.0.6 | MIT |
| @types/koa | 3.0.3 | MIT |
| @types/koa-compose | 3.2.9 | MIT |
| @types/node | 24.19.2 | MIT |
| @types/oidc-provider | 9.12.1 | MIT |
| @types/pg | 8.23.1 | MIT |
| @types/qs | 6.15.1 | MIT |
| @types/range-parser | 1.2.7 | MIT |
| @types/send | 1.2.1 | MIT |
| @types/serve-static | 2.2.0 | MIT |
| @typescript-eslint/eslint-plugin | 8.72.2 | MIT |
| @typescript-eslint/parser | 8.72.2 | MIT |
| @typescript-eslint/project-service | 8.72.2 | MIT |
| @typescript-eslint/scope-manager | 8.72.2 | MIT |
| @typescript-eslint/tsconfig-utils | 8.72.2 | MIT |
| @typescript-eslint/type-utils | 8.72.2 | MIT |
| @typescript-eslint/types | 8.72.2 | MIT |
| @typescript-eslint/typescript-estree | 8.72.2 | MIT |
| @typescript-eslint/utils | 8.72.2 | MIT |
| @typescript-eslint/visitor-keys | 8.72.2 | MIT |
| @vitest/mocker | 5.1.0 | MIT |
| @vitest/spy | 5.1.0 | MIT |
| accepts | 1.3.8 | MIT |
| acorn | 8.19.0 | MIT |
| acorn-jsx | 5.3.2 | MIT |
| ajv | 6.15.0 | MIT |
| assertion-error | 2.0.1 | MIT |
| balanced-match | 4.0.4 | MIT |
| base64-js | 1.5.1 | MIT |
| bowser | 2.15.0 | MIT |
| brace-expansion | 5.0.13 | MIT |
| brotli | 1.3.3 | MIT |
| cacheable | 2.5.0 | MIT |
| chai | 6.3.0 | MIT |
| content-disposition | 1.0.1 | MIT |
| content-type | 2.1.0 | MIT |
| content-type | 1.0.5 | MIT |
| cookies | 0.9.2 | MIT |
| cron-parser | 5.10.6 | MIT |
| cross-spawn | 7.0.6 | MIT |
| culori | 4.0.2 | MIT |
| dbmate | 2.36.0 | MIT |
| debug | 4.4.3 | MIT |
| deep-equal | 1.0.1 | MIT |
| deep-is | 0.1.4 | MIT |
| delegates | 1.0.0 | MIT |
| depd | 1.1.2 | MIT |
| depd | 2.0.0 | MIT |
| destroy | 1.2.0 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| dfa | 1.2.0 | MIT |
| ee-first | 1.1.1 | MIT |
| encodeurl | 2.0.3 | MIT |
| es-module-lexer | 2.3.2 | MIT |
| esbuild | 0.28.2 | MIT |
| escape-html | 1.0.3 | MIT |
| escape-string-regexp | 4.0.0 | MIT |
| eslint | 10.15.0 | MIT |
| eslint-config-prettier | 10.1.8 | MIT |
| eslint-scope | 9.1.2 | BSD-2-Clause |
| eslint-visitor-keys | 3.4.3 | Apache-2.0 |
| eslint-visitor-keys | 5.0.1 | Apache-2.0 |
| espree | 11.2.0 | BSD-2-Clause |
| esquery | 1.7.0 | BSD-3-Clause |
| esrecurse | 4.3.0 | BSD-2-Clause |
| estraverse | 5.3.0 | BSD-2-Clause |
| estree-walker | 3.0.3 | MIT |
| esutils | 2.0.3 | BSD-2-Clause |
| expect-type | 1.4.0 | Apache-2.0 |
| fast-check | 4.10.2 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-json-stable-stringify | 2.1.0 | MIT |
| fast-levenshtein | 2.0.6 | MIT |
| fdir | 6.5.0 | MIT |
| fflate | 0.8.3 | MIT |
| file-entry-cache | 11.1.5 | MIT |
| find-up | 5.0.0 | MIT |
| flat-cache | 6.1.23 | MIT |
| flatted | 3.4.4 | ISC |
| fresh | 0.5.2 | MIT |
| fsevents | 2.3.3 | MIT |
| glob-parent | 6.0.2 | ISC |
| hashery | 1.5.1 | MIT |
| hookified | 1.15.1 | MIT |
| hookified | 2.2.0 | MIT |
| html-entities | 2.6.0 | MIT |
| http-assert | 1.5.0 | MIT |
| http-errors | 2.0.1 | MIT |
| http-errors | 1.8.1 | MIT |
| ignore | 5.3.2 | MIT |
| ignore | 7.0.14 | MIT |
| imurmurhash | 0.1.4 | MIT |
| inherits | 2.0.4 | ISC |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| isexe | 2.0.0 | ISC |
| jose | 6.2.17 | MIT |
| json-schema-traverse | 0.4.1 | MIT |
| json-stable-stringify-without-jsonify | 1.0.1 | MIT |
| keygrip | 1.1.0 | MIT |
| keyv | 5.6.0 | MIT |
| koa | 3.3.0 | MIT |
| koa-compose | 4.1.0 | MIT |
| lefthook | 2.2.2 | MIT |
| lefthook-android-arm64 | 2.2.2 | MIT |
| lefthook-darwin-arm64 | 2.2.2 | MIT |
| lefthook-darwin-x64 | 2.2.2 | MIT |
| lefthook-freebsd-arm64 | 2.2.2 | MIT |
| lefthook-freebsd-x64 | 2.2.2 | MIT |
| lefthook-linux-arm64 | 2.2.2 | MIT |
| lefthook-linux-x64 | 2.2.2 | MIT |
| lefthook-openbsd-arm64 | 2.2.2 | MIT |
| lefthook-openbsd-x64 | 2.2.2 | MIT |
| lefthook-windows-arm64 | 2.2.2 | MIT |
| lefthook-windows-x64 | 2.2.2 | MIT |
| levn | 0.4.1 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-android-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-freebsd-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-win32-arm64-msvc | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| locate-path | 6.0.0 | MIT |
| luxon | 3.7.2 | MIT |
| magic-string | 1.4.5 | MIT |
| media-typer | 1.1.1 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-db | 1.54.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mime-types | 3.0.2 | MIT |
| minimatch | 11.0.8 | BlueOak-1.0.0 |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.20 | MIT |
| natural-compare | 1.4.0 | MIT |
| negotiator | 0.6.3 | MIT |
| node-html-better-parser | 1.5.9 | MIT |
| non-error | 0.1.0 | MIT |
| oauth4webapi | 3.8.8 | MIT |
| obug | 3.0.0 | MIT |
| oidc-provider | 9.12.2 | MIT |
| on-finished | 2.4.2 | MIT |
| openid-client | 6.8.8 | MIT |
| optionator | 0.9.4 | MIT |
| orderedmap | 2.1.1 | MIT |
| p-limit | 3.1.0 | MIT |
| p-locate | 5.0.0 | MIT |
| parseurl | 1.3.3 | MIT |
| path-exists | 4.0.0 | MIT |
| path-key | 3.1.1 | MIT |
| pdfjs-dist | 6.5.438 | Apache-2.0 |
| pg | 8.23.1 | MIT |
| pg-boss | 12.38.0 | MIT |
| pg-cloudflare | 1.4.1 | MIT |
| pg-connection-string | 2.14.1 | MIT |
| pg-int8 | 1.0.1 | ISC |
| pg-pool | 3.14.0 | MIT |
| pg-protocol | 1.16.1 | MIT |
| pg-types | 2.2.0 | MIT |
| pgpass | 1.0.5 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| postcss | 8.5.33 | MIT |
| postgres-array | 2.0.0 | MIT |
| postgres-bytea | 1.0.1 | MIT |
| postgres-date | 1.0.7 | MIT |
| postgres-interval | 1.2.0 | MIT |
| prelude-ls | 1.2.1 | MIT |
| prettier | 3.9.10 | MIT |
| prosemirror-changeset | 2.4.6 | MIT |
| prosemirror-commands | 1.7.2 | MIT |
| prosemirror-dropcursor | 1.8.4 | MIT |
| prosemirror-gapcursor | 1.4.1 | MIT |
| prosemirror-history | 1.5.2 | MIT |
| prosemirror-inputrules | 1.7.0 | MIT |
| prosemirror-keymap | 1.2.3 | MIT |
| prosemirror-model | 1.25.13 | MIT |
| prosemirror-schema-list | 1.6.1 | MIT |
| prosemirror-state | 1.4.4 | MIT |
| prosemirror-tables | 1.8.5 | MIT |
| prosemirror-transform | 1.12.7 | MIT |
| prosemirror-view | 1.43.0 | MIT |
| punycode | 2.3.1 | MIT |
| pure-rand | 8.4.2 | MIT |
| qified | 0.10.1 | MIT |
| restructure | 3.0.2 | MIT |
| rolldown | 1.2.19 | MIT |
| rope-sequence | 1.3.4 | MIT |
| rrule-temporal | 2.2.9 | MIT |
| semver | 7.8.6 | ISC |
| serialize-error | 13.1.0 | MIT |
| setprototypeof | 1.2.0 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| source-map-js | 1.2.2 | BSD-3-Clause |
| split2 | 4.2.0 | ISC |
| statuses | 1.5.0 | MIT |
| statuses | 2.0.2 | MIT |
| std-env | 4.3.0 | MIT |
| tagged-tag | 1.0.0 | MIT |
| temporal-spec | 1.0.1 | Apache-2.0 |
| tinybench | 6.2.3 | MIT |
| tinyexec | 1.3.1 | MIT |
| tinyglobby | 0.2.17 | MIT |
| toidentifier | 1.0.1 | MIT |
| ts-api-utils | 2.5.0 | MIT |
| tslib | 2.9.1 | 0BSD |
| tsscmp | 1.0.6 | MIT |
| tsx | 4.23.15 | MIT |
| type-check | 0.4.0 | MIT |
| type-fest | 5.10.0 | (MIT OR CC0-1.0) |
| type-is | 2.1.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| typescript-eslint | 8.72.2 | MIT |
| undici-types | 7.24.6 | MIT |
| unpdf | 2.2.1 | MIT |
| uqr | 0.1.2 | MIT |
| uri-js | 4.4.1 | BSD-2-Clause |
| vary | 1.1.2 | MIT |
| vite | 8.3.8 | MIT |
| vitest | 5.1.0 | MIT |
| w3c-keyname | 2.2.8 | MIT |
| which | 2.0.2 | ISC |
| why-is-node-running | 3.2.1 | MIT |
| word-wrap | 1.2.5 | MIT |
| xtend | 4.0.2 | MIT |
| yaml | 2.9.1 | ISC |
| yocto-queue | 0.1.0 | MIT |
| zod | 4.6.7 | MIT |

### Preloader

| Paket | Verzija | Licenca |
|---|---|---|
| @axe-core/playwright | 4.14.0 | MPL-2.0 |
| @emnapi/core | 2.0.0-beta.2 | MIT |
| @emnapi/runtime | 2.0.0-beta.2 | MIT |
| @emnapi/wasi-threads | 2.2.0 | MIT |
| @esbuild/aix-ppc64 | 0.28.2 | MIT |
| @esbuild/android-arm | 0.28.2 | MIT |
| @esbuild/android-arm64 | 0.28.2 | MIT |
| @esbuild/android-x64 | 0.28.2 | MIT |
| @esbuild/darwin-arm64 | 0.28.2 | MIT |
| @esbuild/darwin-x64 | 0.28.2 | MIT |
| @esbuild/freebsd-arm64 | 0.28.2 | MIT |
| @esbuild/freebsd-x64 | 0.28.2 | MIT |
| @esbuild/linux-arm | 0.28.2 | MIT |
| @esbuild/linux-arm64 | 0.28.2 | MIT |
| @esbuild/linux-ia32 | 0.28.2 | MIT |
| @esbuild/linux-loong64 | 0.28.2 | MIT |
| @esbuild/linux-mips64el | 0.28.2 | MIT |
| @esbuild/linux-ppc64 | 0.28.2 | MIT |
| @esbuild/linux-riscv64 | 0.28.2 | MIT |
| @esbuild/linux-s390x | 0.28.2 | MIT |
| @esbuild/linux-x64 | 0.28.2 | MIT |
| @esbuild/netbsd-arm64 | 0.28.2 | MIT |
| @esbuild/netbsd-x64 | 0.28.2 | MIT |
| @esbuild/openbsd-arm64 | 0.28.2 | MIT |
| @esbuild/openbsd-x64 | 0.28.2 | MIT |
| @esbuild/openharmony-arm64 | 0.28.2 | MIT |
| @esbuild/sunos-x64 | 0.28.2 | MIT |
| @esbuild/win32-arm64 | 0.28.2 | MIT |
| @esbuild/win32-ia32 | 0.28.2 | MIT |
| @esbuild/win32-x64 | 0.28.2 | MIT |
| @jridgewell/resolve-uri | 3.1.3 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @napi-rs/wasm-runtime | 1.2.6 | MIT |
| @oxc-project/types | 0.156.0 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| @rolldown/binding-android-arm-eabi | 1.2.19 | MIT |
| @rolldown/binding-android-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-x64 | 1.2.19 | MIT |
| @rolldown/binding-freebsd-x64 | 1.2.19 | MIT |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-musl | 1.2.19 | MIT |
| @rolldown/binding-linux-ppc64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-s390x-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-musl | 1.2.19 | MIT |
| @rolldown/binding-openharmony-arm64 | 1.2.19 | MIT |
| @rolldown/binding-wasm32-wasi | 1.2.19 | MIT |
| @rolldown/binding-win32-arm64-msvc | 1.2.19 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.19 | MIT |
| @rolldown/pluginutils | 1.1.1 | MIT |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/chai | 5.2.3 | MIT |
| @types/deep-eql | 4.0.2 | MIT |
| @types/estree | 1.0.10 | MIT |
| @types/node | 24.19.2 | MIT |
| @types/whatwg-mimetype | 3.0.2 | MIT |
| @types/ws | 8.18.2 | MIT |
| @vitest/mocker | 5.1.0 | MIT |
| @vitest/spy | 5.1.0 | MIT |
| ajv | 8.20.0 | MIT |
| assertion-error | 2.0.1 | MIT |
| axe-core | 4.14.1 | MPL-2.0 |
| buffer-image-size | 0.6.4 | MIT |
| chai | 6.3.0 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| entities | 7.0.1 | BSD-2-Clause |
| es-module-lexer | 2.3.2 | MIT |
| esbuild | 0.28.2 | MIT |
| estree-walker | 3.0.3 | MIT |
| expect-type | 1.4.0 | Apache-2.0 |
| fast-check | 4.10.2 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| fdir | 6.5.0 | MIT |
| fsevents | 2.3.3 | MIT |
| happy-dom | 21.0.4 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-android-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-freebsd-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-win32-arm64-msvc | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| magic-string | 1.4.5 | MIT |
| nanoid | 3.3.20 | MIT |
| obug | 3.0.0 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| playwright | 1.63.0 | Apache-2.0 |
| playwright-core | 1.63.0 | Apache-2.0 |
| postcss | 8.5.33 | MIT |
| pure-rand | 8.4.2 | MIT |
| require-from-string | 2.0.2 | MIT |
| rolldown | 1.2.19 | MIT |
| source-map-js | 1.2.2 | BSD-3-Clause |
| std-env | 4.3.0 | MIT |
| tinybench | 6.2.3 | MIT |
| tinyexec | 1.3.1 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tslib | 2.9.1 | 0BSD |
| typescript | 5.9.3 | Apache-2.0 |
| undici-types | 7.24.6 | MIT |
| vite | 8.3.8 | MIT |
| vitest | 5.1.0 | MIT |
| whatwg-mimetype | 3.0.0 | MIT |
| why-is-node-running | 3.2.1 | MIT |
| ws | 8.23.0 | MIT |
| yaml | 2.9.1 | ISC |
