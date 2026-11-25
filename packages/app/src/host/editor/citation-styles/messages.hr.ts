// WEB-V20-STIL-ODABIR: words for the institution's citation style (read only; the student does not choose).
export const citationStyleText = {
  label: "Stil",
  setting: "postavka ustanove",
  loading: "Učitavam stil navođenja ustanove.",
  unavailableStyle: "Stil nije dostupan. Prikazuje se zadani stil FPZG.",
  readFailed: "Stil navođenja ustanove trenutačno nije moguće učitati. Prikazuje se zadani stil FPZG.",
  names: {
    fpzg: "FPZG",
    apa: "APA",
    chicago: "Chicago",
    ieee: "IEEE",
    vancouver: "Vancouver",
  },
} as const;
