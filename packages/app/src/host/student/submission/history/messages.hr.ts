// NF-3 PR-15 (E-11c): "Moje predaje", in the words of the prototype (INVENTAR-student §E-11c).
export const historyText = {
  title: "Moje predaje",
  attempt: "Predaja {n} · {at}",
  afterDeadline: " · nakon roka",
  current: "Trenutno važeća predaja.",
  openReceipt: "Otvori potvrdu o predaji",
  withdrawn: "Povučena {at}.",
  downloadWithdrawal: "Preuzmi potvrdu povlačenja",
  downloadWithdrawalFor: "Preuzmi potvrdu povlačenja predaje {n}",
  earlier: "Ranija predaja.",
  unavailable: "Popis predaja trenutačno nije moguće učitati.",
  retry: "Pokušaj ponovno",
  loading: "Učitavam popis predaja.",
} as const;
