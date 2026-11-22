// VIZ-CSS (Daniel 22. 11. 2026.: the look is copied from the prototype): which
// screens sit in the shell (SideShell, the 64 px rail) and which fill the
// window on their own, screen by screen as the prototypes register them
// (docs/prototip/Ductura_student.html and Ductura_nastavnik.html,
// `App.register(name, { shell: 'side' | 'none' })`). Host.tsx reads it; a
// route not listed here keeps the shell.
import { pathMatches } from "../routes";

export type Ljuska = "side" | "none";

/** The app routes of the prototype screens with `shell: 'none'`, with the prototype screen they follow. */
export const BEZ_LJUSKE: Readonly<Record<string, string>> = {
  // Ductura_student.html
  "/rad/[assignmentId]": "rad (Radni prostor)",
  "/rad/[assignmentId]/predaja": "predaja (S-31 Predaja)",
  "/rad/[assignmentId]/predaja/izjava": "izjava (S-31 Izjava)",
  "/rad/[assignmentId]/predaja/pregled": "pregled (S-30 Pregled prije predaje)",
  "/rad/[assignmentId]/predaja/slanje": "predaja (S-31 Predaja)",
  "/rad/[assignmentId]/predaja/potvrda": "potvrda (S-32 Potvrda predaje)",
  // Ductura_nastavnik.html
  "/nastavnik/rad/[id]": "rad (N-06/N-07/N-08 Rad)",
  "/nastavnik/rad/[id]/predaja": "predaja (N-07 Što je student predao)",
  "/nastavnik/rad/[id]/sazetak": "sazetak (N-10 Sažetak i karta podrijetla)",
  "/nastavnik/rad/[id]/reprodukcija": "reprodukcija (N-09 Reprodukcija)",
  "/nastavnik/rad/[id]/usporedba": "usporedba (N-11 Usporedba verzija)",
  "/nastavnik/rad/[id]/konzultacije": "konzultacije (N-12 Konzultacije)",
};

/** The shell of a page's route: "none" for a prototype screen without the rail, "side" otherwise. */
export function ljuskaOf(route: string): Ljuska {
  return Object.keys(BEZ_LJUSKE).some((path) => route === path || pathMatches(path, route)) ? "none" : "side";
}
