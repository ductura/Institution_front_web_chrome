# Postavljanje fronta: Vercel i Render

Front institucije (`packages/app`) gradi se jednom i poslužuje kao statične datoteke pod `/app/web/` i `/app/chrome/`, kao što to radi `dev-server.mjs`. Vite gradi s bazom `/app/web/`, pa obje putanje učitavaju datoteke iz `/app/web/assets/`. Glavni cilj je Vercel. Render je zamjena za slučaj da Vercel ne odgovara.

Postavljanje se pokreće tek na Danielovu riječ. Ova grana samo priprema konfiguraciju.

## Gradnja

Ove naredbe koriste i Vercel i Docker slika:

```bash
npm install -g pnpm@10.33.0
pnpm install --frozen-lockfile
pnpm --dir src/client install --ignore-workspace --frozen-lockfile --ignore-scripts
pnpm --filter @ductura/app run build
```

Rezultat je u `packages/app/dist`. `src/client` se instalira zasebno, kao u CI-ju (posao `app` u `.github/workflows/ci.yml`). Paket `@ductura/contracts` dolazi kao `.tgz` iz izdanja repoa `ductura/Institution_server`, pa gradnja mora moći preuzeti tu datoteku.

## Vercel (`vercel.json`)

- **Projekt:** korijen projekta je korijen repoa, a `framework` je `null`, da Vercel ne pogađa predložak. Zato Dockerfile nije u korijenu: datoteka `Dockerfile` u korijenu mijenja predložak.
- **Gradnja i izlaz:** `installCommand` i `buildCommand` su naredbe iz odjeljka „Gradnja”. `outputDirectory` je `packages/app/dist`.
- **Preusmjeravanja:** `/`, `/app/web` i `/app/chrome` vode na `/app/web/` odnosno `/app/chrome/`.
- **Prepisivanja (redom, vrijedi prvo koje odgovara):**
  1. `/api/v1/*` ide na Institution_server. Adresa je zasad zamjenska: `https://ZAMIJENI-institution-server.invalid`. Prije postavljanja upiši pravu adresu servera na Renderu.
  2. `/app/web/assets/*` i `/app/chrome/assets/*` vode na `/assets/*` u izlazu.
  3. Ostale datoteke s nastavkom pod `/app/web/` i `/app/chrome/` (npr. `favicon.svg`) vode na istu datoteku u korijenu izlaza.
  4. Sve ostalo pod `/app/web/` i `/app/chrome/` dobiva `index.html`, a ekran bira usmjerivač aplikacije. Ruta s točkom u zadnjem dijelu putanje zato bi dala 404.
- **Predmemorija:** datoteke pod `assets/` imaju imena s hashom i šalju se s `immutable`.

Klijent (`src/client/api.ts`) zove API na istom ishodištu (`location.origin`). Zato prepisivanje `/api/v1` mora ostati na istoj domeni kao front. Kolačići sesije tada ostaju na domeni fronta.

## Render (`deploy/render/Dockerfile`)

- **Slika:** u dvije faze. Faza `node:22-bookworm-slim` gradi kao u odjeljku „Gradnja”. Faza `nginxinc/nginx-unprivileged:1.27-alpine` poslužuje `dist` iz `/usr/share/nginx/html/app/web`.
- **Port:** nginx sluša na `$PORT`. Render ga sam postavlja; zadano je 8080. Port se upisuje pri pokretanju iz `deploy/render/default.conf.template`.
- **Putanje:** iste kao na Vercelu. `/app/chrome/*` se iznutra prepisuje na `/app/web/*`, a svaka putanja koja nije datoteka dobiva `index.html`.
- **API:** slika **ne prosljeđuje** `/api/v1`. Na Renderu to mora riješiti nešto ispred fronta: zajednička domena ili edge koji `/api/v1` šalje Institution_serveru. Druga je mogućnost dodati `proxy_pass` u predložak kad adresa servera bude poznata. Bez toga prijava i podaci ne rade.
- **Kontekst gradnje:** korijen repoa. `.dockerignore` iz konteksta izbacuje `node_modules`, `dist`, rezultate testova, `.git` i `.env*`.

Gradnja slike:

```bash
docker build -f deploy/render/Dockerfile -t ductura-front .
docker run --rm -e PORT=8080 -p 8080:8080 ductura-front
```

Na Renderu: Web Service iz ovog repoa, okruženje Docker, Dockerfile Path `deploy/render/Dockerfile`, Docker Context `.`.

## Što još treba prije postavljanja

1. Prava adresa Institution_servera umjesto `ZAMIJENI-institution-server.invalid` u `vercel.json`.
2. Odluka kako `/api/v1` stiže do servera na Renderu (vidi gore).
3. Provjera da se `.tgz` paketi iz izdanja `ductura/Institution_server` mogu preuzeti iz gradnje na Vercelu i Renderu bez tokena.
4. Slika iz `deploy/render/Dockerfile` još nije izgrađena ni pokrenuta (lokalno nema dovoljno memorije). Prva gradnja na Renderu je i prva provjera.
