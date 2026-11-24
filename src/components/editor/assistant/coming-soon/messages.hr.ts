export const assistantComingSoonHr = {
  title: "Asistent",
  badge: "uskoro",
  // ED-09: decision NF-2 br. 1 (23. 11. 2026., docs/prototip/INVENTAR-editor.md:1586) - the Asistent works in the pilot;
  // its conversation in the editor is not here yet, so the card says that and points to the rules below.
  body: "Asistent u pilotu radi prema pravilima ovog zadatka, navedenima niže. Razgovor s Asistentom u editoru još nije dostupan.",
  purposesTitle: "Svrha korištenja",
  purposesList: "Planirane svrhe pomoćnika",
  purposes: ["Objašnjenje pojma", "Brainstorming", "Jezična dorada", "Prijevod", "Restrukturiranje"],
} as const;
