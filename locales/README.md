# locales

Katalog tekstova sučelja, `hr.ts` (`messagesHr`) i `en.ts` (`messagesEn`). Doslovna je kopija `ductura/server` `locales/` na `2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a`, a ondje je prenesen iz Ductusa `src/lib/i18n` uz zapisana odstupanja ([izvorni README](https://github.com/ductura/server/blob/2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a/locales/README.md)). Tekst se mijenja samo uz isti tekst na serveru.

- Svaki tekst čita [skener zabranjenih izraza](../scripts/forbidden-terms/README.md). Datoteka koja nije na zatvorenom popisu ruši skener.
- Katalog je u korijenu, a ne u `src/`, jer je čisti podatak. Skener `.ts` katalog čita iz sintaksnog stabla, pa poziv, uvoz vrijednosti, getter ili funkcija ruše test. To je stroža provjera od tekstualne zabrane mrežnih poziva (`src/client/no-direct-api.test.ts`). Ta zabrana `locales/` ne čita, jer engleske riječi „from” i „import” u tekstu daju lažne pogotke.
