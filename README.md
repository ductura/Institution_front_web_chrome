# Ductura / web-chrome

Prioritetni frontend za Google Chrome na računalu. Preloader ovamo šalje korisnike Chromea na Windowsu, macOS-u i Linuxu.

## Funkcionalna provjera

Izmjena u editoru ostaje spremljena nakon osvježavanja stranice. Pokriva je `e2e/editor-persists.spec.js` u svakom stupcu e2e matrice (DAN-755, `docs/PLAN.md` §6): `chromium`, `chrome` (pravi Google Chrome), `firefox`, `webkit`, `edge` (Microsoft Edge), `mobile-pixel-7`, `mobile-iphone-14`, `tablet-ipad` i `tablet-ipad-landscape`. Stupci se izvode jedan po jedan jer dijele memorijski API. `chrome` i `edge` registriraju se u CI-ju ili uz `DUCTURA_BRANDED=1`; Opera se provjerava ručno prije izdanja.

## Pokretanje

```bash
npm install
npm run dev                 # http://localhost:5173 s memorijskim API-jem
npm run test:helpers        # pomoćne funkcije (public/lib/doc.js)
npx playwright install chromium firefox webkit   # chrome i msedge samo uz DUCTURA_BRANDED=1
npm run test:functional     # funkcionalni test u pregledniku
```

`dev-server.mjs` oponaša `Ductura/server` API. U produkciji frontend zove pravi API na `/api` iste domene (ductura.org).
