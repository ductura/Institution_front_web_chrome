/**
 * VIZ-CSS: the frame of each screen of the approved prototypes (`shell: 'side'`
 * or `shell: 'none'`, and `narrow`), as Ductura_student.html and
 * Ductura_nastavnik.html register them with App.register. Host.tsx reads it,
 * so no page decides its own frame.
 *
 * `shell` is what the prototype says. `own` is whether the app's page brings
 * the frame itself today (its own top bar and main): only then does Host
 * leave the SideShell out. A screen whose prototype says "none" but whose page
 * does not yet draw its own frame stays inside the SideShell until VIZ-S1
 * (the shared frame PR) gives it one; the difference is listed in the PR.
 */
import { pathMatches } from "../routes";

export type ShellKind = "side" | "none";
export type Role = "student" | "teacher";

export type ScreenFrame = {
  /** The route, in the pattern of routes.ts. */
  readonly path: string;
  readonly role: Role;
  /** The prototype's screen (S-nn / N-nn). */
  readonly screen: string;
  /** `shell` in the prototype. */
  readonly shell: ShellKind;
  /** `narrow` in the prototype: .main.narrow (640 px; 680 px for the teacher). */
  readonly narrow: boolean;
  /** The page draws its own frame (top bar, main) today. */
  readonly own: boolean;
};

const s = (path: string, screen: string, shell: ShellKind, narrow = false, own = false): ScreenFrame => ({ path, role: "student", screen, shell, narrow, own });
const n = (path: string, screen: string, shell: ShellKind, narrow = false, own = false): ScreenFrame => ({ path, role: "teacher", screen, shell, narrow, own });

export const SCREEN_FRAMES: readonly ScreenFrame[] = [
  s("/prijava", "S-01 Prijava", "none", false, true),
  s("/zadaci", "S-02 Početna", "side"),
  s("/zadaci/kolegiji", "S-03 Moji kolegiji", "side"),
  s("/upis", "S-04 Upis kodom", "side", true),
  s("/upis/kolegij/[courseId]", "S-04 Upis kodom", "side", true),
  s("/zadatak/[id]", "S-05 Obavijest o zadatku", "side", true),
  s("/zadaci/radovi", "Moji radovi", "side"),
  s("/zadaci/dnevnik-prakse", "Dnevnik prakse", "side"),
  s("/zadaci/gradivo-kodiranja", "Gradivo za kodiranje", "side"),
  s("/zadaci/kodiranje-izvoz", "Izvoz kodiranja", "side"),
  s("/zadatak/[id]/tim", "Moj tim", "side", true),
  s("/zadatak/[id]/recenzija", "Recenzija radova", "side", true),
  s("/zadatak/[id]/recenzija/primljene", "Primljene recenzije", "side", true),
  s("/zadatak/[id]/recenzija/rad/[taskId]", "Recenzija rada", "side", true),
  s("/rad/[assignmentId]", "Radni prostor", "none", false, true),
  s("/rad/[assignmentId]/predaja", "S-31 Izjava", "none", false, true),
  s("/rad/[assignmentId]/predaja/pregled", "S-30 Pregled prije predaje", "none", false, true),
  s("/rad/[assignmentId]/predaja/izjava", "S-31 Izjava", "none", false, true),
  s("/rad/[assignmentId]/predaja/slanje", "S-31 Predaja", "none", false, true),
  s("/rad/[assignmentId]/predaja/potvrda", "S-32 Potvrda predaje", "none", false, true),
  n("/nastavnik", "N-01 Moji kolegiji", "side"),
  n("/nastavnik/kolegiji", "N-01 Moji kolegiji", "side"),
  n("/nastavnik/zadatak/novi", "N-02/N-03 Novi kolegij i zadatak", "side", true),
  n("/nastavnik/kolegiji/[courseId]/studenti", "N-04 Popis studenata", "side"),
  n("/nastavnik/mentorstva", "N-16 Radovi uz mentora", "side"),
  n("/nastavnik/mentorstva/dnevnik-prakse", "Dnevnik prakse studenata", "side"),
  n("/nastavnik/brz-put", "N-05 Brz put", "side"),
  n("/nastavnik/zbirni", "N-17 Zbirni pregled", "side"),
  n("/nastavnik/kolegiji/[courseId]/zbirno", "N-17 Zbirni pregled", "side"),
  n("/nastavnik/rad/[id]", "N-06/N-07/N-08 Rad", "none"),
  n("/nastavnik/rad/[id]/predaja", "N-07 Što je student predao", "none"),
  n("/nastavnik/rad/[id]/sazetak", "N-10 Sažetak i karta podrijetla", "none"),
  n("/nastavnik/rad/[id]/reprodukcija", "N-09 Reprodukcija", "none"),
  n("/nastavnik/rad/[id]/usporedba", "N-11 Usporedba verzija", "none"),
  n("/nastavnik/rad/[id]/konzultacije", "N-12 Konzultacije", "none"),
  n("/nastavnik/rad/[id]/pregled", "NF5-P Pregled rada", "none"),
  n("/nastavnik/zadatak/[assignmentId]/produljenje", "N-13 Produljenje roka", "side", true),
  n("/nastavnik/zadatak/[assignmentId]/timovi", "Timovi na zadatku", "side"),
  n("/nastavnik/zadatak/[assignmentId]/recenzija", "Recenzija među studentima", "side"),
  n("/nastavnik/zadatak/[assignmentId]/testovi", "Testovi uz zadatak", "side"),
  n("/nastavnik/zadatak/[assignmentId]/merlin", "N-18 Izvoz za Merlin", "side"),
];

/** The frame the prototype gives a route for a role, or null for a route the prototypes do not have. */
export function frameOf(route: string, role: Role | null): ScreenFrame | null {
  if (role === null) return null;
  return SCREEN_FRAMES.find((frame) => frame.role === role && pathMatches(frame.path, route)) ?? null;
}

/** Whether Host leaves the SideShell out: the prototype says "none" and the page draws its own frame. */
export function withoutShell(route: string, role: Role | null): boolean {
  const frame = frameOf(route, role);
  return frame !== null && frame.shell === "none" && frame.own;
}

/** Whether the page sits in .main.narrow. */
export function isNarrow(route: string, role: Role | null): boolean {
  return frameOf(route, role)?.narrow === true;
}
