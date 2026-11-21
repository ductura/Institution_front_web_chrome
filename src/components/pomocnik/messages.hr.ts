import type { AssistantThreadLabels } from "@ductura/ui";

export const assistantThreadHr = {
  conversation: "Razgovor s pomoćnikom",
  user: "Vi",
  assistant: "Pomoćnik",
  empty: "Još nema poruka.",
  prompt: "Poruka pomoćniku",
  send: "Pošalji pomoćniku",
  waiting: "Pomoćnik odgovara…",
  disabled: "Slanje poruka trenutačno nije dostupno.",
  warning: {
    title: "U tekstu su osobni podaci",
    description: "Pružatelju ih ne treba slati.",
    kinds: { email: "E-adresa", longNumber: "OIB ili dugi broj", phone: "Broj telefona" },
    removeAndSend: "Ukloni ih i pošalji",
    sendAnyway: "Pošalji svejedno",
    cancel: "Odustani",
  },
} satisfies AssistantThreadLabels;
