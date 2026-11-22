// WEB-2141 (paritet, Ljuska nastavnika): the texts of the teacher's shell that
// differ from the shared catalogue, as in the prototype (INVENTAR-nastavnik).
export const teacherShellHr = {
  /** The fourth item of the navigation: "Zbirni" (A-9), not "Zbirni pregled". */
  navSummary: "Zbirni",
  /** Below 800 px the side bar opens behind a text button "Izbornik", not an icon. */
  menu: "Izbornik",
  /** The loading line of each teacher screen, instead of the general "Učitavanje…". */
  loadingCourses: "Učitavanje kolegija…",
  loadingMentorships: "Učitavanje mentorstava…",
  loadingSummary: "Učitavanje zbirnog pregleda…",
  loadingExtensions: "Učitavanje rokova…",
} as const;
