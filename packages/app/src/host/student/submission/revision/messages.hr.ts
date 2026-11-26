// NF-3 PR-16 (E-7b): the revision as one whole beside the submission, in the words of the prototype.
export const revisionText = {
  title: "Rad je kod Vas: dorada",
  dueTag: "Dorada do {due}",
  tag: "Dorada",
  lead: "Nastavnik je vratio rad na doradu. Doradu predajete istim koracima kao i rad.",
  comment: "Komentar nastavnika",
  due: "Rok dorade",
  dueMissing: "nije naveden",
  declaration: "Prije predaje dorade pregledajte izjavu i, ako se nešto promijenilo, ispravite je i potvrdite ponovno.",
  send: "Pošalji doradu",
  sending: "Šaljem doradu…",
  sent: "Dorada je poslana nastavniku.",
  sendSessionExpired: "Prijava je istekla. Prijavite se ponovno i pošaljite doradu.",
  sendForbidden: "Doradu za ovaj rad ne možete poslati.",
  sendConflict: "Dorada se trenutačno ne može poslati: rad nije vraćen na doradu ili je rok istekao.",
  sendUnknown: "Dorada nije poslana jer odgovor nije potvrđen. Pokušajte ponovno.",
} as const;
