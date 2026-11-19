# `src/_cekanje`: stranice koje čekaju svoj val

WEB-01 (Ductus#2028, komentar 7008147932). Ovdje su stranice i API rukovatelji iz `src/app` koji još čitaju bazu izravno (`@/server/*`, `withActor`) ili uvoze takve datoteke. Mapa je izvan `src/app` i isključena iz korijenskog `tsconfig.json`, pa je Next ne usmjerava i ne gradi.

- Svaki PR stranice vraća svoju rutu odavde u `src/app` i prebacuje je na `/api/v1` (klijent `src/client`).
- Stari `api/**` rukovatelji ne vraćaju se: sve ide na Institution_server preko `/api/v1` (WEB-02).
- Komponente iz `src/components` koje uvoze `@/server` ostale su na mjestu: Next ih ne gradi dok ih stranica ne uvozi, a njihovi testovi i dalje se izvode. Prebacuje ih PR stranice koja ih koristi.
- Što ostane ovdje na kraju vala 4, popisuje se i čeka svoj val.
