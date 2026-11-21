import { NotificationBell, type NotificationBellLabels, type NotificationEntry } from "@ductura/ui";

import type { CatalogState } from "./coverage";

// The shell's own texts (packages/app shell/notifications/text.ts), repeated here for the catalogue.
const LABELS: NotificationBellLabels = {
  button: "Obavijesti",
  buttonWithCount: (n) => `Obavijesti, nepročitanih: ${n}`,
  panel: "Popis obavijesti",
  empty: "Nema obavijesti.",
  unavailable: "Obavijesti trenutačno nisu dostupne.",
  unreadMark: "Novo",
  changed: (n) => `Nepročitanih obavijesti: ${n}`,
};

const ENTRIES: NotificationEntry[] = [
  { id: "n1", text: "Novi komentar na radu", when: "3. 11. 2026. 09:14", read: false, href: "#rad-1" },
  { id: "n2", text: "Nova verzija zadatka", when: "2. 11. 2026. 16:40", read: true, href: "#rad-2" },
];
const nothing = () => {};

const bell = (props: { entries?: NotificationEntry[]; unread?: number; status?: "ready" | "unavailable"; open?: boolean }) => (
  <NotificationBell entries={props.entries ?? []} unread={props.unread ?? 0} status={props.status ?? "ready"}
    labels={LABELS} onOpenEntry={nothing} defaultOpen={props.open ?? false} />
);

export const notificationBellEntries = {
  NotificationBell: {
    prazno: () => bell({ open: true }),
    učitavanje: () => bell({ open: true }), // first read pending: the list is empty until it answers
    greška: () => bell({ status: "unavailable", open: true }),
    puno: () => bell({ entries: ENTRIES, unread: 1, open: true }),
    onemogućeno: () => bell({ entries: ENTRIES.map((e) => ({ ...e, read: true })), open: true }), // all read: no count, no mark
  },
} satisfies Record<string, Record<CatalogState, () => React.ReactNode>>;
