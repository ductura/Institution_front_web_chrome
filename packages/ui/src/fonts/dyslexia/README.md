# Font za disleksiju: izvor i licenca

**Stanje: datoteka fonta NIJE uključena.** Font bira vlasnik (val20-razlika §2.1, §5);
dok licenca nije potvrđena, u ovaj direktorij ne ide nijedna datoteka fonta.

Do tada `reading-font.css` koristi samo `local()` izvore (font koji korisnik već ima,
npr. Lexend ili OpenDyslexic) i zatim font aplikacije. Nema CDN-a ni `url()`-a.

Kad vlasnik odabere font (preporuka: SIL OFL, npr. Lexend ili OpenDyslexic):
1. dodaj `.woff2` i tekst licence (kao `../OFL-*.txt`) u ovaj direktorij;
2. u `reading-font.css` dodaj `url("./dyslexia/<datoteka>.woff2") format("woff2")` iza `local()` izvora;
3. upiši ime, verziju, SHA-256 i izvor u tablicu ispod; `dyslexia.test.ts` tada
   dopušta samo lokalni `url()` na datoteku iz ovog direktorija.

| Datoteka | Bajtovi | SHA-256 | Izvor | Licenca |
| --- | ---: | --- | --- | --- |
| (nema) | | | | |
