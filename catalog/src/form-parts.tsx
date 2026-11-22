import { EntryList, FormSection, OptionGroup, SummaryList } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// Invented example text only.
const AI = [
  { value: "course", label: "Kao u kolegiju: dopušten za sažimanje literature, uz izjavu" },
  { value: "summary", label: "Samo sažimanje literature, uz izjavu" },
  { value: "none", label: "Nije dopušten u ovom zadatku" },
];
const ROWS = [
  { id: "course", label: "Kolegij", value: "Izmišljeni seminar iz ekologije grada" },
  { id: "title", label: "Naslov", value: "Kućno kompostiranje" },
  { id: "range", label: "Opseg", value: "3000 do 5000 riječi" },
];

const TURNS = [
  { id: "1", who: "Student A · 10:01", text: "Sažmi tri glavna pristupa iz poglavlja o institucijama." },
  { id: "2", who: "AI pomoćnik, model M-2 · 10:02", text: "Prvi pristup naglašava pravila, drugi interese." },
];

export const formPartsEntries = {
  EntryList: {
    prazno: () => <><p>Još nema zapisanih razgovora.</p><EntryList entries={[]} /></>,
    učitavanje: () => <EntryList entries={[{ id: "l", who: "Razgovor", text: "Učitavanje…" }]} />,
    greška: () => <EntryList entries={[{ id: "g", who: "Razgovor", text: "Razgovor se nije mogao prikazati." }]} />,
    puno: () => <EntryList entries={TURNS} />,
    onemogućeno: () => <EntryList entries={TURNS.slice(0, 1)} />,
  } satisfies Record<CatalogState, () => ReactNode>,
  FormSection: {
    prazno: () => <FormSection id="fp-e" title="Osnovno"><p>Odjeljak još nema polja.</p></FormSection>,
    učitavanje: () => <FormSection id="fp-l" title="Osnovno"><p role="status">Obrazac se učitava…</p></FormSection>,
    greška: () => <FormSection id="fp-g" title="Osnovno"><p role="alert">Odjeljak se nije mogao prikazati.</p></FormSection>,
    puno: () => <FormSection id="fp-p" title="Rok i opseg"><p>Rok mora biti nakon otvaranja.</p></FormSection>,
    onemogućeno: () => <FormSection id="fp-o" title="Što se bilježi"><p>Samo za čitanje.</p></FormSection>,
  } satisfies Record<CatalogState, () => ReactNode>,
  OptionGroup: {
    prazno: () => <OptionGroup legend="Vanjski alati" name="fpg-e" value="" options={[]} />,
    učitavanje: () => <OptionGroup legend="AI pomoćnik u Ducturi" name="fpg-l" value="" options={AI.map((o) => ({ ...o, disabled: true }))} />,
    greška: () => <OptionGroup legend="AI pomoćnik u Ducturi" name="fpg-g" value="" options={AI} />,
    puno: () => <OptionGroup legend="AI pomoćnik u Ducturi" name="fpg-p" value="course" options={AI} />,
    onemogućeno: () => <OptionGroup legend="Grupe" name="fpg-o" kind="checkbox" value={["2"]} disabled
      options={[{ value: "2", label: "Grupa 2" }, { value: "4", label: "Grupa 4" }]} />,
  } satisfies Record<CatalogState, () => ReactNode>,
  SummaryList: {
    prazno: () => <><p>Podaci zadatka još nisu uneseni.</p><SummaryList rows={[]} /></>,
    učitavanje: () => <SummaryList rows={ROWS.map((r) => ({ ...r, value: "…" }))} />,
    greška: () => <SummaryList rows={[{ id: "e", label: "Podaci zadatka", value: "nisu dostupni" }]} />,
    puno: () => <SummaryList rows={ROWS} />,
    onemogućeno: () => <SummaryList rows={ROWS.slice(0, 1)} />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
