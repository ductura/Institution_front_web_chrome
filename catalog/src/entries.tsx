import { Button, Card, SaveState, TextField } from "@ductura/ui";

import { messagesHr as t } from "../../locales/hr.ts";
import { AppShell, ErrorScreen, RouteLoading } from "../../src/components/index.ts";

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

// The web's own components (src/components, DAN-753), texts from locales/ only.
const SCOPE = "c2NvcGUtb2YtYW4taW52ZW50ZWQtcGVyc29u";
const work = [t.shell.nav.assignments];
const page = <p>{t.home.workBody}</p>;

export const SCREEN_ENTRIES = {
  AppShell: {
    prazno: () => <AppShell role={null} scope={null} crumbs={[]} ownMain>{page}</AppShell>,
    učitavanje: () => <AppShell role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="status">{t.student.loading}</p></AppShell>,
    greška: () => <AppShell role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain><p role="alert">{t.errorPage.errorBody}</p></AppShell>,
    puno: () => <AppShell role="student" scope={SCOPE} current="/zadaci" crumbs={work} ownMain>{page}</AppShell>,
    onemogućeno: () => <AppShell role={null} scope={SCOPE} crumbs={[]} ownMain>{page}</AppShell>,
  },
  ErrorScreen: {
    prazno: () => <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    učitavanje: () => <RouteLoading label={t.student.loading} />,
    greška: () => <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={() => {}} />,
    puno: () => <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />,
    onemogućeno: () => <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} />,
  },
  RouteLoading: {
    prazno: () => <RouteLoading label={t.workspace.panelLoading} />,
    učitavanje: () => <RouteLoading label={t.fastPath.loading} />,
    greška: () => <RouteLoading label={t.student.loading} />,
    puno: () => <RouteLoading label={t.workspace.statusLoading} />,
    onemogućeno: () => <RouteLoading label={t.workspace.panelLoading} />,
  },
} satisfies Record<string, Entry> satisfies CatalogEntries;
