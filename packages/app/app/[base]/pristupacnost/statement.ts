/**
 * The accessibility statement (WEB-1805, M11.6, F-03, D-248): the facts it
 * states, as named constants, and its text in both interface languages
 * (D-70). The sections follow the model statement the Croatian law asks for
 * (Zakon o pristupačnosti mrežnih stranica i programskih rješenja za pokretne
 * uređaje tijela javnog sektora, NN 17/2019, which transposes Directive (EU)
 * 2016/2102; model of Implementing Decision (EU) 2018/1523): status of
 * compliance, inaccessible content, preparation, feedback and contact,
 * enforcement procedure. The standard is HRN EN 301 549.
 */

/** The day the statement was prepared and last reviewed (Zagreb date). */
export const STATEMENT_PREPARED = "2026-11-21T12:00:00+01:00";

/** The harmonised standard the statement is measured against, and its WCAG level. */
export const STANDARD = "HRN EN 301 549 V3.2.1 (2021-03)";

/** The status of compliance: partial until the manual screen-reader check is recorded for every main screen. */
export const COMPLIANCE: "full" | "partial" | "none" = "partial";

/** The enforcement body under Article 11 of the law and how it is reached (public office data). */
export const ENFORCEMENT_BODY = {
  name: "Povjerenik za informiranje",
  address: "Jurjevska ulica 24, 10000 Zagreb",
  phone: "+385 1 4609 041",
  email: "pristupacnost@pristupinfo.hr",
  web: "https://www.pristupinfo.hr",
} as const;

export const statementHr = {
  title: "Izjava o pristupačnosti",
  intro:
    "Ductura nastoji osigurati pristupačnost ove mrežne aplikacije u skladu sa Zakonom o pristupačnosti mrežnih stranica i programskih rješenja za pokretne uređaje tijela javnog sektora (Narodne novine, broj 17/2019), kojim je u hrvatsko zakonodavstvo prenesena Direktiva (EU) 2016/2102.",
  scope: "Ova izjava primjenjuje se na mrežnu aplikaciju Ductura za studente, nastavnike i administratore fakulteta.",
  status: {
    heading: "Status usklađenosti",
    partial: `Ova mrežna aplikacija djelomično je usklađena sa Zakonom i normom ${STANDARD}, koja upućuje na Smjernice za pristupačnost web-sadržaja (WCAG) 2.1, razinu AA. Cilj za sve ekrane je razina AA Smjernica WCAG 2.2. Neusklađenosti su navedene u nastavku.`,
    full: `Ova mrežna aplikacija u potpunosti je usklađena sa Zakonom i normom ${STANDARD}, koja upućuje na Smjernice za pristupačnost web-sadržaja (WCAG) 2.1, razinu AA.`,
    none: `Ova mrežna aplikacija nije usklađena sa Zakonom i normom ${STANDARD}. Neusklađenosti su navedene u nastavku.`,
  },
  checked: {
    heading: "Što je provjereno",
    items: [
      "Svi glavni ekrani provjereni su automatskim alatom axe prema kriterijima razina A i AA, u tamnoj i svijetloj temi te na širini računala i mobitela.",
      "Fokus tipkovnice vidljiv je na svakom elementu do kojeg se dolazi tipkom Tab.",
    ],
  },
  inaccessible: {
    heading: "Nepristupačni sadržaj",
    lead: "Sadržaj naveden u nastavku nije pristupačan iz sljedećih razloga.",
    nonCompliance: {
      heading: "Neusklađenost sa Zakonom",
      items: [
        "Provjera čitačem zaslona (NVDA u pregledniku Chrome i VoiceOver) još nije zapisana za sve ekrane. Automatska provjera ne otkriva sve prepreke, pa dijelovi aplikacije mogu biti teže upotrebljivi čitačem zaslona (WCAG 1.3.1, 4.1.2).",
        "Reprodukcija nastanka rada prikazuje promjene redom kojim su nastale. Njezina upotrebljivost čitačem zaslona još nije provjerena (WCAG 1.3.1, 2.2.2).",
      ],
    },
    burden: {
      heading: "Nerazmjerno opterećenje",
      text: "Ductura se ne poziva na nerazmjerno opterećenje.",
    },
    outOfScope: {
      heading: "Sadržaj izvan opsega Zakona",
      text: "Datoteke koje korisnici sami dodaju (izvori, prilozi i tekst rada) nisu obuhvaćene ovom izjavom.",
    },
  },
  preparation: {
    heading: "Priprema ove izjave",
    prepared: "Izjava je sastavljena {date}.",
    method:
      "Metoda: samoprocjena, uz automatsku provjeru svih glavnih ekrana i ručnu provjeru tipkovnicom. Izjava se preispituje najmanje jednom godišnje i nakon svake veće promjene sučelja.",
  },
  feedback: {
    heading: "Povratne informacije i podaci za kontakt",
    text:
      "Ako uočite sadržaj koji nije pristupačan ili Vam treba informacija u pristupačnom obliku, javite se administratoru svog fakulteta. U poruci navedite ekran i što ste pokušali napraviti. Odgovor ćete dobiti najkasnije u roku od 15 dana od primitka upita.",
  },
  enforcement: {
    heading: "Postupak praćenja provedbe",
    text:
      "Nadzor nad provedbom Zakona provodi Povjerenik za informiranje. Ako na upit ne dobijete odgovor ili niste zadovoljni odgovorom, možete se obratiti Povjereniku za informiranje.",
    address: "Adresa",
    phone: "Telefon",
    email: "E-pošta",
    web: "Mrežna stranica",
  },
  home: "Na početnu",
};

export type StatementText = typeof statementHr;

export const statementEn: StatementText = {
  title: "Accessibility statement",
  intro:
    "Ductura is committed to making this web application accessible in accordance with the Croatian Act on the Accessibility of Websites and Mobile Applications of Public Sector Bodies (Official Gazette No. 17/2019), which transposes Directive (EU) 2016/2102 into Croatian law.",
  scope: "This statement applies to the Ductura web application for students, teachers and faculty administrators.",
  status: {
    heading: "Compliance status",
    partial: `This web application is partially compliant with the Act and with the standard ${STANDARD}, which refers to the Web Content Accessibility Guidelines (WCAG) 2.1, level AA. The aim for every screen is level AA of WCAG 2.2. The non-compliances are listed below.`,
    full: `This web application is fully compliant with the Act and with the standard ${STANDARD}, which refers to the Web Content Accessibility Guidelines (WCAG) 2.1, level AA.`,
    none: `This web application is not compliant with the Act and with the standard ${STANDARD}. The non-compliances are listed below.`,
  },
  checked: {
    heading: "What has been checked",
    items: [
      "Every main screen has been checked with the automated tool axe against the level A and AA criteria, in the dark and the light theme, at desktop and mobile width.",
      "Keyboard focus is visible on every element reached with the Tab key.",
    ],
  },
  inaccessible: {
    heading: "Non-accessible content",
    lead: "The content listed below is non-accessible for the following reasons.",
    nonCompliance: {
      heading: "Non-compliance with the Act",
      items: [
        "A check with a screen reader (NVDA in Chrome and VoiceOver) has not yet been recorded for every screen. An automated check does not find every barrier, so parts of the application may be harder to use with a screen reader (WCAG 1.3.1, 4.1.2).",
        "The replay of how a work was written shows the changes in the order they were made. Its use with a screen reader has not yet been checked (WCAG 1.3.1, 2.2.2).",
      ],
    },
    burden: {
      heading: "Disproportionate burden",
      text: "Ductura does not claim a disproportionate burden.",
    },
    outOfScope: {
      heading: "Content outside the scope of the Act",
      text: "Files that users add themselves (sources, attachments and the text of a work) are not covered by this statement.",
    },
  },
  preparation: {
    heading: "Preparation of this statement",
    prepared: "This statement was prepared on {date}.",
    method:
      "Method: a self-assessment, with an automated check of every main screen and a manual keyboard check. The statement is reviewed at least once a year and after every major change to the interface.",
  },
  feedback: {
    heading: "Feedback and contact information",
    text:
      "If you find content that is not accessible or need information in an accessible format, contact the administrator of your faculty. Say which screen it was and what you tried to do. You will receive a reply within 15 days of your enquiry at the latest.",
  },
  enforcement: {
    heading: "Enforcement procedure",
    text:
      "The Information Commissioner supervises the implementation of the Act. If you receive no reply to your enquiry or are not satisfied with the reply, you can contact the Information Commissioner.",
    address: "Address",
    phone: "Telephone",
    email: "Email",
    web: "Website",
  },
  home: "To the home page",
};
