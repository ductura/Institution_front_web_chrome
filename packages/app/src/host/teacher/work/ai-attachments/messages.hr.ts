import type { TeacherAiAttachmentsLabels } from "@ductura/ui";

// Same copy as the catalogue entry (catalog/src/teacher-ai-attachments.tsx).
export const teacherAiLabels: TeacherAiAttachmentsLabels = {
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
