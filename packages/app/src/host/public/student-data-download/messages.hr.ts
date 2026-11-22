import type { StudentDataDownloadLabels } from "@ductura/ui";

/** Interface text of the student's one-time download of their data (WEB-1302; SRV-1308). */
export const studentDataDownloadMessages = {
  labels: {
    title: "Izvoz mojih podataka",
    lead: "Poveznica vrijedi samo jednom. Datoteku spremite na sigurno mjesto.",
    download: "Preuzmi izvoz",
    downloading: "Preuzimam izvoz…",
    done: "Izvoz je preuzet. Poveznica više ne vrijedi.",
    gone: "Poveznica je već iskorištena ili je istekla. Za novi izvoz javite se referadi.",
  } satisfies StudentDataDownloadLabels,
  unavailable: "Preuzimanje trenutačno nije moguće. Pokušajte ponovno.",
} as const;
