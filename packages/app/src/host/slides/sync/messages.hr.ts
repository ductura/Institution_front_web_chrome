// WEB-V13-DNEVNIK-SINKRONIZACIJA: the words of the slides session. Interface
// text is Croatian; the save states themselves are worded by @ductura/ui
// ("Spremljeno na uređaju", "Spremljeno na poslužitelju"), never here.
export const slidesSyncText = {
  retry: "Pokušaj ponovno",
  blockedTitle: "Rad je otvoren u drugoj kartici",
  blockedBody: "Ova kartica ništa ne sprema. Nastavite u kartici u kojoj je rad otvoren ili je zatvorite pa se vratite ovdje.",
  unavailableTitle: "Spremanje na ovom uređaju nije moguće",
  unavailableBody: "Slajdovi se ne mogu otvoriti uz spremanje. Rad nije promijenjen.",
  signedOutTitle: "Prijava je završena",
  signedOutBody: "Prijavite se ponovno kako biste nastavili s radom.",
  stoppedNote: "Zapis promjena je prekinut. Slajdovi se i dalje spremaju na ovom uređaju, ali poslužitelj ih više ne preuzima.",
  refusedNote: "Poslužitelj nije preuzeo zadnju promjenu. Ponovno učitajte stranicu da se pošalje ponovno.",
  recoveryTitle: "Potrebna je odluka o spremljenoj verziji",
  recoveryBody: "Verzija na ovom uređaju i verzija na poslužitelju se razlikuju. Prikazana je verzija s ovog uređaja i ne mijenja se.",
  adopt: "Preuzmi verziju s poslužitelja",
  adoptNote: "Verzija s ovog uređaja ostaje sačuvana na uređaju kao kopija.",
  adoptConfirm: "Potvrđujem preuzimanje",
  adoptDone: "Preuzeta je verzija s poslužitelja. Ponovno učitajte stranicu.",
  adoptFailed: "Preuzimanje nije uspjelo. Rad nije promijenjen.",
} as const;
