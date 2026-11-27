export const selectionBubbleHr = {
  label: "Radnje za označeni tekst",
  menuLabel: "Izbornik teksta",
  actions: {
    comment: "Komentar",
    cite: "Navod",
    toQuote: "U blok-citat",
    toFootnote: "U fusnotu",
    stash: "Odloži",
  },
  footnoteDone: "Označeni tekst je premješten u fusnotu.",
  stashed: "Tekst je odložen. Vraćate ga iz lijevog stupca, iz odjeljka Odloženo.",
  stashFailed: "Tekst nije odložen jer ga ovaj preglednik ne može spremiti.",
  failed: "To ovdje nije moguće.",
} as const;
