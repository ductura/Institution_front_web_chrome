# OSN-W4 osnovica-csp-stranica

Zapisnik osnovice (nastavak OSN-B4, SRV #634: slučajevi politike stranica su u WEB repou). Izvor: danielrisavi77-create/Ductus `src/server/http/content-security-policy.ts`, njegov test i `middleware.ts` na 0cdb0f1f (isti sadržaj kao na `main` 22. 11. 2026.). Preneseno u `src/lib/security/content-security-policy.ts`, `src/lib/security/content-security-policy.test.ts` i `src/middleware.ts` (Next aplikacija nad `src/app`, `pnpm next:build`).

Jedan redak po Ductusovom slučaju iz `content-security-policy.test.ts`:

- politika builda je točna, bez `unsafe-inline` i `unsafe-eval`: preneseno.
- `unsafe-eval` za skripte i `unsafe-inline` za stilove samo pod `next dev`: preneseno.
- `form-action 'self'` bez ishodišta izdavatelja (A6): preneseno.
- `form-action 'self' <izdavatelj>` s ishodištem izdavatelja (A6, dio prvog slučaja): preneseno.
- odbija nonce: prazan: preneseno.
- odbija nonce: kratak: preneseno.
- odbija nonce: 129 bita: preneseno.
- odbija nonce: prekid popisa izvora (`'; script-src *`): preneseno.
- odbija nonce: razmak: preneseno.
- odbija hash bez prefiksa `sha256-`: preneseno.
- odbija hash `sha384-`: preneseno.
- odbija hash koji prekida popis (`' 'unsafe-inline`): preneseno.
- THEME_SCRIPT dopuštena po hashu stvarnog teksta (`src/components/shell/theme.ts`, uvezeno, nepromijenjeno): preneseno.
- `issuerOriginOf` je null za nedostajući OIDC_ISSUER: preneseno.
- `issuerOriginOf` je null za prazan: preneseno.
- `issuerOriginOf` je null za vrijednost koja nije URL: preneseno.
- `issuerOriginOf` je null za `javascript:`: preneseno.
- `issuerOriginOf` je null za `data:`: preneseno.
- `issuerOriginOf` je null za `ftp:`: preneseno.
- `issuerOriginOf` daje samo ishodište, bez putanje, upita i vjerodajnica: preneseno.
- nonce ima 128 bita i nov je pri svakom pozivu (A7, 1000 poziva): preneseno.
- politika API odgovora (`API_CONTENT_SECURITY_POLICY`): preneseno.
- middleware: nov nonce i politika na zahtjevu (za Next) i odgovoru, `/api/*`, `_next/static/` i `favicon.ico` izvan matchera: preneseno (`src/middleware.ts`; provjereno ručno s `next start`, vidi PR).

Nije u opsegu (otvoreno):

- `packages/app` (domaćin pod `/app/web/`, `pnpm build`) nema politiku stranica. Njegov `app/layout.tsx` ima vlastitu inline skriptu teme (drugi tekst, pa drugi hash od THEME_SCRIPT) i dio stranica može biti prerenderiran bez noncea. Prijenos tamo traži zaseban zadatak u traci domaćina.
- Statička politika API odgovora (`next.config.ts` u Ductusu postavlja `API_CONTENT_SECURITY_POLICY` i `STATIC_CONTENT_SECURITY_POLICY` kao zaglavlja): konstante su prenesene, `next.config.ts` nije na putanjama ovog zadatka.
