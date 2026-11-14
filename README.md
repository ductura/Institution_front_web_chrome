# Ductura / web-chrome

Prioritetni frontend za Google Chrome na računalu. Preloader ovamo šalje korisnike Chromea na Windowsu, macOS-u i Linuxu.

## Funkcionalna provjera

Izmjena u editoru ostaje spremljena nakon osvježavanja stranice. Pokriva je `e2e/editor-persists.spec.js` (Playwright, Google Chrome).

## Pokretanje

```bash
npm install
npm run dev                 # http://localhost:5173 s memorijskim API-jem
npm run test:helpers        # pomoćne funkcije (public/lib/doc.js)
npx playwright install chromium
npm run test:functional     # funkcionalni test u pregledniku
```

`dev-server.mjs` oponaša `Ductura/server` API. U produkciji frontend zove pravi API na `/api` iste domene (ductura.org).
