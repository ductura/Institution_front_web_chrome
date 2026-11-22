import {
  Button, StepActions, StepCheck, StepDecl, StepEntry, StepFrame, StepKv, StepLine, StepLoading, StepMono, StepNav, StepPanel, StepPlaces,
  StepQr, StepSection, StepSpinner, StepSub,
} from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// VIZ-S4: the frame of submission steps 2 to 5 (E-8 to E-11). Invented course and work only.
type Five = Record<CatalogState, () => ReactNode>;
const frame = (children: ReactNode, label = "Predaja", wide = false) => (
  <StepFrame backHref="#rad" course="Izmišljeni seminar iz ekologije grada" title="Izmišljeni esej o kompostiranju" label={label} wide={wide}>
    {children}
  </StepFrame>
);
const SAMPLE_HEX = "3f9a 01bc 77d2 e480 9a5c 1d36 b2e7 4c08 e1f4 a93b 6d70 c285 5b1e 0f49 d6a3 8e72";

export const submissionStepEntries = {
  StepFrame: {
    prazno: () => frame(<p className="note">Rad još nije započet. Započnite ga u radnom prostoru.</p>),
    učitavanje: () => frame(<StepLoading message="Učitavam stanje rada s poslužitelja." />),
    greška: () => frame(<p className="note" role="alert">Stanje rada trenutačno nije moguće učitati.</p>),
    puno: () => frame(<StepNav current={3} />, "Prije predaje"),
    onemogućeno: () => frame(<p className="note">Rad je predan i više se ne mijenja.</p>, "Potvrda"),
  } satisfies Five,
  StepNav: {
    prazno: () => <StepNav current={1} />,
    učitavanje: () => <StepLoading message="Učitavam korake predaje." />,
    greška: () => <><StepNav current={4} /><p className="note" role="alert">Korak nije dovršen.</p></>,
    puno: () => <StepNav current={3} />,
    onemogućeno: () => <><StepNav current={5} /><p className="note">Rad je predan.</p></>,
  } satisfies Five,
  StepPanel: {
    prazno: () => <StepPanel title="Predaja"><p className="note">Rad još nije započet. Započnite ga u radnom prostoru.</p></StepPanel>,
    učitavanje: () => <StepPanel title="Predaja" busy><StepLoading message="Učitavam stanje rada s poslužitelja." /></StepPanel>,
    greška: () => (
      <StepPanel title="Predaja">
        <p className="note" role="alert">Stanje rada trenutačno nije moguće učitati.</p>
        <StepActions><Button tone="secondary">Pokušaj ponovno</Button></StepActions>
      </StepPanel>
    ),
    puno: () => <StepPanel title="Prije predaje" tag="Seminarski rad"><p className="note">Popis pokazuje je li sve priloženo. Ne ocjenjuje rad.</p></StepPanel>,
    onemogućeno: () => <StepPanel title="Predaja" tag="Bez veze"><p className="note" role="status">Nema veze s poslužiteljem. Predaja traži vezu.</p></StepPanel>,
  } satisfies Five,
  StepLoading: {
    prazno: () => <StepLoading message="Još nema stanja za učitavanje." />,
    učitavanje: () => <StepLoading message="Učitavam potvrdu s poslužitelja." />,
    greška: () => <><StepLoading message="Učitavanje traje dulje nego obično." /><p className="note" role="alert">Pokušajte ponovno.</p></>,
    puno: () => <StepLoading message="Učitavam zabilježene stavke i priloge." />,
    onemogućeno: () => <StepLoading message="Učitavanje nije dostupno bez veze." />,
  } satisfies Five,
  StepSection: {
    prazno: () => <StepSection label="Mjesta za izvor koja ste ostavili u tekstu"><span>Nema otvorenih mjesta za izvor.</span></StepSection>,
    učitavanje: () => <StepSection label="Izjava"><span>Učitavam…</span></StepSection>,
    greška: () => <StepSection label="Izjava"><span>Još nije potvrđena.</span><a href="#izjava">Otvori izjavu</a></StepSection>,
    puno: () => <StepSection label="Mjesta za izvor koja ste ostavili u tekstu"><StepPlaces><li><a href="#rad">2. Teorijski okvir, odlomak 4</a></li></StepPlaces></StepSection>,
    onemogućeno: () => <StepSection label="Pravila oblika"><span>Provjera oblika još nije pokrenuta.</span></StepSection>,
  } satisfies Five,
  StepKv: {
    prazno: () => <StepKv label="Vrijeme predaje">još nije zabilježeno</StepKv>,
    učitavanje: () => <StepKv label="Rok">učitavam…</StepKv>,
    greška: () => <StepKv label="Rok">nije moguće učitati</StepKv>,
    puno: () => <StepKv label="Rok">5. 11. 2026. u 23:59 (UTC+1)</StepKv>,
    onemogućeno: () => <StepKv label="Riječi u predanom tekstu">5.120</StepKv>,
  } satisfies Five,
  StepDecl: {
    prazno: () => <StepDecl title="Vaša izjava" own><p className="note">Izjava još nije ispunjena.</p></StepDecl>,
    učitavanje: () => <StepDecl title="Zabilježeno u Ducturi"><p className="note" role="status">Učitavam zabilježene stavke.</p></StepDecl>,
    greška: () => <StepDecl title="Zabilježeno u Ducturi"><p className="note" role="alert">Zabilježene stavke nije moguće učitati.</p></StepDecl>,
    puno: () => (
      <StepDecl title="Vaša izjava" own>
        <StepKv label="Vanjski alati">nijedan</StepKv>
        <StepKv label="Svrha">sažimanje literature</StepKv>
      </StepDecl>
    ),
    onemogućeno: () => <StepDecl title="Zabilježeno u Ducturi"><p className="note">Izjava je predana s radom i više se ne mijenja.</p></StepDecl>,
  } satisfies Five,
  StepEntry: {
    prazno: () => <StepEntry who="Nema zabilježenih stavki." />,
    učitavanje: () => <StepEntry who="Učitavam…" />,
    greška: () => <StepEntry who="Stavku nije moguće prikazati." />,
    puno: () => <StepEntry who="Model M-2 · 2. Teorijski okvir, odlomak 1">Prijenos iz AI pomoćnika, 28. 10. 2026. u 10:05</StepEntry>,
    onemogućeno: () => <StepEntry who="Vi · 10:01">Samo za čitanje.</StepEntry>,
  } satisfies Five,
  StepActions: {
    prazno: () => <StepActions><Button tone="secondary">Natrag</Button></StepActions>,
    učitavanje: () => <StepActions><Button busy>Predaja u tijeku…</Button></StepActions>,
    greška: () => <StepActions><Button tone="secondary">Pokušaj ponovno</Button></StepActions>,
    puno: () => <StepActions><Button>Predaj rad</Button><Button tone="secondary">Natrag</Button></StepActions>,
    onemogućeno: () => <StepActions><Button aria-disabled="true">Dalje</Button><Button tone="secondary">Natrag</Button></StepActions>,
  } satisfies Five,
  StepLine: {
    prazno: () => <StepLine>Nema zabilježenih lijepljenja.</StepLine>,
    učitavanje: () => <StepLine>Učitavam lijepljenja…</StepLine>,
    greška: () => <StepLine>Lijepljenja nije moguće prikazati.</StepLine>,
    puno: () => <StepLine tag={<span className="tag">opaženo</span>}>22. 10. 2026., odsječak oko 10:35 · 640 znakova</StepLine>,
    onemogućeno: () => <StepLine tag={<span className="tag open">izjavljeno</span>}>Napomena je samo za čitanje.</StepLine>,
  } satisfies Five,
  StepSub: {
    prazno: () => <StepSub>Prilozi</StepSub>,
    učitavanje: () => <StepSub>Učitavam priloge…</StepSub>,
    greška: () => <StepSub>Prilozi nisu učitani</StepSub>,
    puno: () => <StepSub>Otisak predanog teksta</StepSub>,
    onemogućeno: () => <StepSub>Pitanje nastavnika</StepSub>,
  } satisfies Five,
  StepMono: {
    prazno: () => <StepMono>Otisak još nije izračunan.</StepMono>,
    učitavanje: () => <StepMono>Računam otisak…</StepMono>,
    greška: () => <StepMono>Otisak nije moguće prikazati.</StepMono>,
    puno: () => <StepMono>{SAMPLE_HEX}</StepMono>,
    onemogućeno: () => <StepMono>requestedAt 2026-11-05T20:14:07.482193Z</StepMono>,
  } satisfies Five,
  StepPlaces: {
    prazno: () => <StepPlaces><li>Nema mjesta.</li></StepPlaces>,
    učitavanje: () => <StepPlaces><li>Učitavam mjesta…</li></StepPlaces>,
    greška: () => <StepPlaces><li>Mjesta nije moguće prikazati.</li></StepPlaces>,
    puno: () => <StepPlaces><li><a href="#rad">1. Uvod, odlomak 3</a></li><li><a href="#rad">3. Analiza, odlomak 2</a></li></StepPlaces>,
    onemogućeno: () => <StepPlaces><li>Rad je predan, mjesta se ne mijenjaju.</li></StepPlaces>,
  } satisfies Five,
  StepCheck: {
    prazno: () => <StepCheck id="c1" checked={false} onChange={() => undefined}>Potvrđujem izjavu</StepCheck>,
    učitavanje: () => <p>Učitavam izjavu…</p>,
    greška: () => <p role="alert">Izjavu zato još nije moguće potvrditi.</p>,
    puno: () => <StepCheck id="c2" checked onChange={() => undefined}>Potvrđujem izjavu</StepCheck>,
    onemogućeno: () => <p>Izjava je predana s radom i više se ne mijenja.</p>,
  } satisfies Five,
  StepSpinner: {
    prazno: () => <p>Nema predaje u tijeku.</p>,
    učitavanje: () => <p><StepSpinner /> Predaja u tijeku…</p>,
    greška: () => <p role="alert">Predaja nije dovršena.</p>,
    puno: () => <p><StepSpinner /> Predaja u tijeku…</p>,
    onemogućeno: () => <p>Predaja nije dostupna bez veze.</p>,
  } satisfies Five,
  StepQr: {
    prazno: () => <StepQr>QR kod nije dostupan dok potvrda ne stigne.</StepQr>,
    učitavanje: () => <StepQr>Učitavam potvrdu.</StepQr>,
    greška: () => <StepQr>QR kod nije moguće prikazati.</StepQr>,
    puno: () => <StepQr>QR kod je u preuzetom zapisu. Ovdje je samo uzorak bez sadržaja.</StepQr>,
    onemogućeno: () => <StepQr label="Uzorak QR koda">Preuzimanje zapisa trenutačno nije dostupno.</StepQr>,
  } satisfies Five,
};
