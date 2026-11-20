export const workHistoryMessages = {
  title: "Povijest rada",
  lead: "Točke rada. Točka nastaje sama pri predaji etape, slanju dorade i predaji rada.",
  count: { one: "{n} točka", few: "{n} točke", many: "{n} točaka" },
  loading: "Učitavam povijest rada…",
  error: "Povijest rada trenutačno nije moguće učitati.",
  retry: "Pokušaj ponovno",
  empty: "Još nema točaka rada.",
  at: "u",
  revision: "verzija {n}",
  reasons: {
    stage_submitted: "Predana etapa",
    revision_sent: "Poslana dorada",
    work_submitted: "Predan rad",
    manual: "Točka rada",
  },
  close: "Zatvori",
  unavailable: "Povijest rada nije dostupna na ovoj stranici.",
} as const;
