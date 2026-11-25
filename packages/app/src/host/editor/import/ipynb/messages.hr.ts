// WEB-V21-STEM-IPYNB-UVOZ: texts for importing a notebook (.ipynb). Display only; nothing is run.
export const ipynbHr = {
  hint: "Bilježnicu (.ipynb, do 1 MB i 200 ćelija) možete uvesti samo za prikaz: kôd se ne izvršava.",
  previewMeta: (name: string, blocks: number) => `${name} · blokova: ${blocks}`,
  discarded: (n: number) => (n === 0 ? "" : `Odbačeno izlaza (HTML, JavaScript, slike i ostalo): ${n.toLocaleString("hr-HR")}.`),
  outputCaption: "Izlaz",
  done: (blocks: number, discarded: number) =>
    `Uvezeno blokova: ${blocks.toLocaleString("hr-HR")}, označeno kao uvezeno.${discarded === 0 ? "" : ` Odbačeno izlaza: ${discarded.toLocaleString("hr-HR")}.`}`,
  refused: {
    tooLarge: "Bilježnica je veća od 1 MB. Odaberite manju.",
    tooManyCells: "Bilježnica ima više od 200 ćelija. Odaberite manju.",
    invalid: "Bilježnicu nije moguće pročitati. Provjerite je li ispravna.",
    empty: "U bilježnici nema teksta ni kôda za uvoz.",
    unreadable: "Datoteku nije moguće pročitati.",
    noCodeBlocks: "Uređivač u ovom radu još ne podržava uvezeni kôd ni oznaku uvezenog teksta, pa se bilježnica ne može uvesti.",
    insertFailed: "Bilježnicu nije bilo moguće umetnuti u rad. Pregled je sačuvan, pokušajte ponovno.",
  },
} as const;
