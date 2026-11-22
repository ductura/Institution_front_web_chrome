# Podrijetlo prenesenih oznaka

Oznake dizajna („papir i grafit”, D-188) prenesene su iz repoa
`danielrisavi77-create/Ductus` na commitu
`d52a92c3a108f3f0ec9c3639188a2ea669bba582` (DAN-750, web 2.c1, plan `web.md` §4 A2).
Datoteke iz prve tablice su bajt-za-bajt iste kao izvor; `src/provenance.test.ts`
računa Git blob SHA svake datoteke i ruši se ako se razlikuje od tablice.
Promjena oznake ide prvo u Ductus, a ovamo novim prijenosom s novim SHA-om.

| Datoteka ovdje | Izvor u Ductusu | Git blob SHA |
| --- | --- | --- |
| `src/tokens/globals.css` | `app/globals.css` | `ab7e22e17c6519853e1296ede7712144ef453c52` |
| `src/fonts/InstrumentSans-latin-ext.woff2` | `app/fonts/InstrumentSans-latin-ext.woff2` | `138162d4e237ceb4b10c4f7a9607957a6a1a97b0` |
| `src/fonts/InstrumentSans-latin.woff2` | `app/fonts/InstrumentSans-latin.woff2` | `665fa65c8c97c5c99581eaf6a0ab8d1b45e6060e` |
| `src/fonts/JetBrainsMono-latin-ext.woff2` | `app/fonts/JetBrainsMono-latin-ext.woff2` | `310faddfdd181f2dbef10b26ce9231504762d045` |
| `src/fonts/JetBrainsMono-latin.woff2` | `app/fonts/JetBrainsMono-latin.woff2` | `2ca6ac605954ee884442db8ea1d61093000bcc29` |
| `src/fonts/Newsreader-latin-ext.woff2` | `app/fonts/Newsreader-latin-ext.woff2` | `f8ff7403b9f5370a4ec90d3a364f89149d2868c4` |
| `src/fonts/Newsreader-latin.woff2` | `app/fonts/Newsreader-latin.woff2` | `002e47997a982993b138e12af08630dadd70bd61` |
| `src/fonts/OFL-InstrumentSans.txt` | `app/fonts/OFL-InstrumentSans.txt` | `26bd2f954bfa282d235370728095db97d8a36f6f` |
| `src/fonts/OFL-JetBrainsMono.txt` | `app/fonts/OFL-JetBrainsMono.txt` | `821a3dac22aff15a1f1c9689a1d79c45bb58ca39` |
| `src/fonts/OFL-Newsreader.txt` | `app/fonts/OFL-Newsreader.txt` | `d2d4f407109e9c74b8ab502fc79b912408ab8e41` |
| `src/fonts/SOURCE.md` | `app/fonts/SOURCE.md` | `9f10583f3ae26495f6bd8c39d134458ecb047928` |
| `src/fonts/fonts.css` | `app/fonts/fonts.css` | `80f26bdb9b052ba6511eddb32c1c425cdafec0c2` |
| `src/theme/theme.ts` | `src/components/shell/theme.ts` | `8a56a3f5c77a563fbebc14ebe036abdfa2203faf` |

## Prilagođeno pri prijenosu

| Datoteka ovdje | Izvor (blob SHA) | Razlika |
| --- | --- | --- |
| `src/tokens/tokens.test.ts` | `src/components/shell/tokens.test.ts` (`8a3bfcd7ef96f430c06c09a90d85336eec2a8a68`) | samo putanja do `globals.css`; isti testovi (29) i iste tvrdnje |
| `src/theme/theme.test.ts` | `src/components/shell/theme.test.ts` (`27e3eeeb40331f2ef2d41e46b442f0cc4809514a`) | izostavljen test „the shared 404 page applies the kept theme”: čita Ductusove `app/not-found.tsx` i `ThemeRestore.tsx`, koji dolaze s 2.c4 |
| `src/fonts/faces.css` | zamjena za `app/fonts/index.ts` (`next/font/local`) | iste datoteke, težine i `unicode-range` kao obični `@font-face`, bez Nexta |
| `src/tokens/tokens.css` | nova datoteka (nema izvora) | ulaz paketa `@ductura/ui/tokens.css`: uvozi neizmijenjeni `globals.css` i listovima (`.sheet`, svijetli list) daje vlastiti `--error`, da tekst greške na svijetlom listu u tamnoj ljusci ima kontrast 4,5:1 (ZEL-W14) |
| `src/tokens/tokens-overlay.test.ts` | nova datoteka (nema izvora) | provjerava redoslijed uvoza i kontrast `--error` na oba lista |
| `src/tokens/prototype.css` | nova datoteka (nema izvora u Ductusu) | sloj vizualnog pariteta s odobrenim prototipovima (VIZ-0, `docs/prototip/`): ljestvica slova, razmaka i mjera, četiri boje podrijetla iz editora v0.27, osnovna pravila elemenata i zajedničke klase prototipa (`.btn`, `.input`, `.card`, `.tag`, `.tbl` …); `tokens.css` ga uvozi iza `globals.css`, koji ostaje neizmijenjen |
| `src/tokens/prototype.test.ts` | nova datoteka (nema izvora) | provjerava redoslijed uvoza, boje podrijetla (3:1 na podlozi), mjere prototipa i okvir nastavnika |
