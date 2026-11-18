# Podrijetlo prenesenog koda

Kod je prenesen iz repoa `danielrisavi77-create/Ductus` na commitu
`ce908f7a652bfc810a8c266346cd574b8d395da6` (DAN-888, pristup B, dio 888-1). Putanja u tablici je relativna na `src/` (u Ductusu i ovdje ista),
`src/provenance.test.ts` računa Git blob SHA svake datoteke
i ruši se ako se razlikuje od tablice; za izmijenjenu datoteku rekonstruira izvor
obrnutom zamjenom retka uvoza i traži izvorni SHA.

| Ductus put → web put | Git blob SHA izvora | SHA-256 izvora | Izmijenjen |
| --- | --- | --- | --- |
| `domain/document/forbidden.test.ts` | `b7b187d1c640701a80c77654bb13e65b2b4c53ec` | `bdc2abcdbc97ce6e205a696c3b47fe8175793627a95a0004110e7aab859b7e13` | ne |
| `domain/document/forbidden.ts` | `652652cabbb4277f8f7fddd20127c8e71d2fc06d` | `13606201732d800d7735662a14ead63a258c782962ecf9ed176a52d8700bba40` | ne |
| `domain/document/revision-zero.test.ts` | `4bda175c76c8c403060bdf4178f3623bc9ca4a78` | `6acdd5207677fecd97959ba72fdff880c00097a18813bbb951cb53e5351f7a42` | ne |
| `domain/document/revision-zero.ts` | `a58c3ab693e83fa05a1c2aeb2a1bd9fb7188ede9` | `c9490658ff369830e4c2b8bad4605b9bd9577fecdf3b0e26058221f2c952c234` | ne |
| `domain/document/schema.test.ts` | `de16159a2ae58d6c405f80f3c87bbb5acaebdf61` | `a774e00f84079a6acaca0c866298f2dcd3f4d88f101b00c83ea4ec51ae93bd2a` | ne |
| `domain/document/schema.ts` | `d53f48f5ae953726893bd6a8b9320dc6d9604052` | `ec3573af9112be124873ec407ebdcbe4519c5a3f2ffa60dbd437f273b8f4de4e` | ne |
| `domain/document/snapshot.test.ts` | `f112216fb0a4641f2d5a57698ae0727f870944bc` | `0a998a3077e02921fec9ee5c50178adc3cce02f6d74b1f9ff2a1648c7aab7f0d` | ne |
| `domain/document/snapshot.ts` | `00520f126b4ca40d1b7092f04dcc02e6bed4a1ee` | `18949d70ad5480a0637745970be42128e61184bb7d86b4d63ecadd4664572f83` | da |
| `domain/document/validate-sources.ts` | `66b30fd5603be962e2642451604029bf00e1ad0e` | `e47aebd7168c21e130209914b0d3d6f56881b2b58d74629fb4856fda0e66c7f4` | ne |
| `domain/document/validate.hardening.test.ts` | `3b2c63b82691dc3a8a125f71be72ba87cd10708c` | `117cf5363c830ca8291e0df37bdcc1f7ba1d9ddc161d6b3dd018fe6265bb88f5` | ne |
| `domain/document/validate.ts` | `bf4906a17d30cc29660e4637f8819c325ccdc516` | `16b224e8f76f32f477d50cf54d261eccf56b0fbb4b38969d7d095ad449e42216` | ne |
| `domain/forensics/crypto.test.ts` | `d8bd19392afcf9e061981e8922db5aa4a14689fd` | `8f2fa6398338ecbb0a791d474b000fc510bd244217c7e53a10bd85f64d61d589` | ne |
| `domain/forensics/crypto.ts` | `b8934b98632a1c6bfc5c1881c3223fc9f5352726` | `a2ff9cae580a602f075f85367c0094e24f95e3f160735610c4af87ae5caff3de` | ne |
| `domain/forensics/forensics.test.ts` | `f038e39e990df9a0f46cb8c0ca3e50955b37a104` | `cc6bbe78a21414e1922956bce1ee5c03747fd9f29fa4c592a4ddfff4cd561572` | ne |
| `domain/forensics/integrity.ts` | `3550a51d5e5d814c7264c8a0053e014a173a3a27` | `35fdacae7a6179de5e2a87dcbc027edc29a13416ab32de7d0cab5444d1f20f7c` | ne |
| `domain/forensics/jcs.test.ts` | `978a418eba0829f874de83145c5a2b2c5904a149` | `cde60fa753fc26f535ae12fcd87cd6482be5a204c11d54f90cf19081dd2a47c4` | ne |
| `domain/forensics/jcs.ts` | `9e51c48eee12db09b8c09f472b1def2d40827019` | `3e421dce7249d33af27e937f3f316f326b03f49b9102f7269f98ff0e547f0723` | ne |
| `domain/forensics/ledger.ts` | `f4bbb9a1467d3a8a6855c45391a7f24071d578e5` | `06f29f5789d31b7470ad81c8a147d7af3c09c135254d8938b9223842f67befc4` | ne |
| `domain/json.test.ts` | `7178dfd770b127ceae83a974737cc0bff19ea360` | `9495752162463b842c1749a159b203fc88d72d6f5eeac1dfde2eb20dac673f4a` | ne |
| `domain/json.ts` | `783873e4201ea9e327a10eb3e36e0d7d90c1ffc6` | `cde02656c3bc490ffe6be823e7fbd0f6cc732df3c8bd97a060c29f75dd45ffb1` | ne |

## Doseg prenesenih testova

- `src/domain/forensics/crypto.test.ts` („has no caller outside src/domain/forensics/crypto*”) obilazi stablo od `process.cwd()`. Testovi paketa rade iz mape paketa, pa ovdje provjerava pozivatelje unutar `packages/editor-core` (`src/`); kod weba izvan paketa taj test ne čita.

## Izmjene

- `src/domain/document/snapshot.ts`: uvoz `@/domain/forensics/jcs` → `../forensics/jcs` (alias `@/` u web paketu ne postoji). Jedina izmjena.

## Nepreneseni testovi izvora (odgoda do 888-2)

Moduli ovog dijela imaju u Ductusu još ove testove. `validate.test` i
`validate-v2.test` odgođeni su samo zbog ograničenja veličine dijela (oko 2500
redaka); ostali čekaju podatke ili ovisnost navedenu u tablici. Prenose se bajt
po bajt s modulima koje pokrivaju.

| Izvorni test | Razlog odgode |
| --- | --- |
| `domain/document/validate.test.ts` (361 redak) | pokriva `validate.ts`; uvozi samo prenesene module, odgođen zbog veličine |
| `domain/document/validate-v2.test.ts` (508 redaka) | pokriva `validate.ts` i `validate-sources.ts`; isto |
| `domain/document/schema-version.test.ts` | čita `forensics/golden-vectors/format-reservation.json`, stiže s vektorima forensics |
| `domain/document/snapshot.fuzz.property.test.ts`, `domain/document/validate-v2.property.test.ts`, `domain/forensics/canonicalization.property.test.ts` | traže `@fast-check/vitest`, stižu s ovisnošću |
