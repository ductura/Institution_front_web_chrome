# Font za disleksiju: izvor i licenca

**Font: OpenDyslexic**, licenca SIL Open Font License 1.1 (`OFL.txt`, doslovna kopija).
Odluka: Daniel delegirao orkestratoru 26. 11. 2026. (zadatak F4-V18-22-R09).

Izvor: `https://github.com/antijingoist/opendyslexic`, commit
`1824da5c0e41dc3e13ffc7f3a636dcaf695d61b7` (11. 8. 2025.), mapa `compiled/`.
Datoteke su nepromijenjene (nije izmijenjen font, pa Reserved Font Name ne smeta).
Poslužuje se isključivo s vlastitog izvora: bez CDN-a, bez udaljenih zahtjeva (A-13).

`reading-font.css` navodi `local()` izvore, a iza njih `url("../fonts/dyslexia/<datoteka>.woff2")`.
`dyslexia.test.ts` dopušta samo `url()` na datoteku iz ovog direktorija i provjerava zbrojeve.

| Datoteka | Bajtovi | SHA-256 | Izvor | Licenca |
| --- | ---: | --- | --- | --- |
| `OpenDyslexic-Regular.woff2` | 103336 | `0441bc21071e42db57c217f93fbc48d3b55a2987c02814c94dc93621c42e8695` | `compiled/OpenDyslexic-Regular.woff2` | OFL 1.1 |
| `OpenDyslexic-Bold.woff2` | 108068 | `b534a0b84ef3cca941ebdb506ce3f4e0010aa4ef881271bac8b6959dbf694fbf` | `compiled/OpenDyslexic-Bold.woff2` | OFL 1.1 |
| `OFL.txt` | | `caafcccfb70fc72458fcbda812ec8f0a06cb300cbabb87eabbb30b946124394b` | `OFL.txt` | OFL 1.1 |

Kurziv nije uključen: sučelje čitanja ga ne traži.
