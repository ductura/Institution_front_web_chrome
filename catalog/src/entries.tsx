import { Button, Card, SaveState, TextField } from "@ductura/ui";

import type { CatalogEntries, CatalogState } from "./coverage";

type Entry = Record<CatalogState, () => React.ReactNode>;

// Invented example text only; no real people or student work.
export const ENTRIES = {
  Button: {
    prazno: () => <Button tone="quiet">Odustani</Button>,
    učitavanje: () => <Button busy>Spremanje…</Button>,
    greška: () => <Button tone="quiet">Pokušajte ponovno</Button>,
    puno: () => <Button>Predaj rad</Button>,
    onemogućeno: () => <Button disabled>Predaj rad</Button>,
  },
  TextField: {
    prazno: () => <TextField label="Naslov rada" placeholder="Npr. Javne politike u lokalnoj zajednici" />,
    učitavanje: () => <TextField label="Naslov rada" busy defaultValue="" hint="Učitavanje…" />,
    greška: () => <TextField label="Naslov rada" defaultValue="" error="Upišite naslov rada." />,
    puno: () => <TextField label="Naslov rada" defaultValue="Javne politike u lokalnoj zajednici" hint="Najviše 120 znakova." />,
    onemogućeno: () => <TextField label="Naslov rada" disabled defaultValue="Javne politike u lokalnoj zajednici" />,
  },
  SaveState: {
    prazno: () => <SaveState state="EDITING" />,
    učitavanje: () => <><SaveState state="SAVING_LOCAL" /><SaveState state="SYNCING" /></>,
    greška: () => <><SaveState state="CONFLICT" /><SaveState state="ERROR" /><SaveState state="RECOVERY_REQUIRED" /></>,
    puno: () => <><SaveState state="LOCAL_DURABLE" /><SaveState state="SYNCED" /></>,
    onemogućeno: () => <SaveState state="EDITING" blocked />,
  },
  Card: {
    prazno: () => <Card title="Moji radovi" empty="Još nema radova." />,
    učitavanje: () => <Card title="Moji radovi" busy />,
    greška: () => <Card title="Moji radovi" error="Popis se nije učitao. Pokušajte ponovno." />,
    puno: () => <Card title="Seminarski rad"><p>Uvod u temu i plan poglavlja.</p></Card>,
    onemogućeno: () => <Card title="Moji radovi" disabled><p>Zadatak je zatvoren.</p></Card>,
  },
} satisfies Record<string, Entry> satisfies CatalogEntries;
