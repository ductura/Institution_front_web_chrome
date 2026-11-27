import { TeacherAiAttachments, type TeacherAiAttachmentsLabels, type TeacherAiAttachmentsState } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

const LABELS: TeacherAiAttachmentsLabels = {
  title: "Uporaba AI-ja",
  confirmed: "Izjava potvrđena",
  noUse: "Izjava: AI alati nisu korišteni. U radu nije zabilježena uporaba Asistenta i nema priloženih razgovora.",
  aiDisabled: "Zadatak ne dopušta ugrađenog Asistenta. Izjava: korišten je vanjski alat.",
  pendingTag: "Dopuna na čekanju",
  pending:
    "Izjava o uporabi AI-ja pri predaji nije mogla biti sastavljena zbog tehničke greške u Ducturi. Izjava i priloženi razgovori pojavit će se ovdje kad student dopuni izjavu. Predaja i rad su dostupni kao i inače.",
  loading: "Učitavam izjavu i priložene razgovore.",
  error: "Izjavu i priložene razgovore trenutačno nije moguće učitati.",
  errorNote: "Ovo je greška u prikazu. Predaja, izjava i priloženi razgovori nisu promijenjeni.",
  retry: "Pokušaj ponovno",
  usesCaption: "Izjava studenta",
  colPurpose: "Svrha",
  colProvider: "Pružatelj i model",
  colPhase: "Faza",
  transfersHeading: "Tekst prenesen u rad iz Asistenta",
  transfersNote: "Popis prikazuje tekst koji je u predanoj verziji rada.",
  attachedHeading: "Priloženi razgovori",
  transferTag: "obvezno",
  studentAddedTag: "priložio student",
  attachedNote:
    "Obvezno: iz razgovora je tekst prenesen u rad. Priložio student: razgovor bez prijenosa, priložen po studentovu izboru. Ostale razgovore student nije priložio i nisu prikazani.",
  externalHeading: "Vanjski alat, izjavljeno",
  externalTag: "izjavljeno",
  externalNote: "Vanjski razgovor je priložio student. Ductura ga nije zabilježila, ne može ga provjeriti i s njim ne uspoređuje tekst rada.",
  open: "Otvori",
  versionNote: "Verzija razgovora kakvu je student pregledao i potvrdio uz izjavu. Samo za čitanje.",
  student: "Student",
  back: "Natrag na uporabu AI-ja",
  sameView: "Student u svojoj predaji vidi ovaj isti prikaz.",
};

const ASSISTANT = "Asistent · Primjer d.o.o., Model A";
const READY: TeacherAiAttachmentsState = {
  kind: "ready",
  confirmedAt: "6. 11. 18:40",
  assistantAllowed: true,
  uses: [
    { purpose: "Lektura", provider: "Primjer d.o.o., Model A", phase: "Pisanje" },
    { purpose: "Traženje literature", provider: "Primjer d.o.o., Model A", phase: "Planiranje" },
  ],
  transfers: [
    {
      id: "catalog-t1",
      heading: "Odlomak 2 · Lektura · 2. 11. 14:05",
      source: "Primjer d.o.o., Model A · „iz AI pomoćnika” · Razgovor 1",
      text: "Izmišljena rečenica o primjeru, prenesena iz odgovora Asistenta.",
    },
  ],
  conversations: [
    {
      conversationId: "catalog-c1",
      title: "Razgovor 1 · Lektura · 2. 11. 14:05",
      reason: "transfer",
      assistantName: ASSISTANT,
      throughSeq: 2,
      turns: [
        { seq: 1, author: "student", text: "Možeš li lektorirati ovaj odlomak o izmišljenom primjeru?" },
        { seq: 2, author: "assistant", text: "Predlažem blaži poredak rečenica. Izmišljen primjer odgovora." },
        { seq: 3, author: "student", text: "Poruka napisana nakon potvrde izjave." },
      ],
      transferredNote: "Preneseno u rad: odlomak 2, „iz AI pomoćnika”.",
    },
    {
      conversationId: "catalog-c3",
      title: "Razgovor 3 · Traženje literature · 3. 11. 09:48",
      reason: "student_added",
      assistantName: ASSISTANT,
      throughSeq: 2,
      turns: [
        { seq: 1, author: "student", text: "Koje vrste izvora bih mogao potražiti za izmišljenu temu?" },
        { seq: 2, author: "assistant", text: "Možete potražiti pregledne radove. Izmišljen primjer odgovora." },
      ],
    },
  ],
  external: [{ id: "catalog-e1", title: "Vanjski alat B · traženje literature · poveznica za dijeljenje" }],
};

const view = (state: TeacherAiAttachmentsState) => <TeacherAiAttachments labels={LABELS} state={state} onRetry={() => undefined} />;

export const teacherAiAttachmentsEntries = {
  TeacherAiAttachments: {
    prazno: () => view({ kind: "no_use", confirmedAt: "6. 11. 18:40" }),
    učitavanje: () => view({ kind: "loading" }),
    greška: () => (
      <div style={{ display: "grid", gap: 24 }}>
        {view({ kind: "error" })}
        {view({ kind: "pending" })}
      </div>
    ),
    puno: () => view(READY),
    onemogućeno: () =>
      view({
        ...READY,
        assistantAllowed: false,
        uses: [{ purpose: "Traženje literature", provider: "Vanjski alat B", phase: "Planiranje" }],
        transfers: [],
        conversations: [],
        external: [
          { id: "catalog-e1", title: "Vanjski razgovor 1 · poveznica za dijeljenje" },
          { id: "catalog-e2", title: "Vanjski razgovor 2 · zalijepljen tekst" },
        ],
      }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
