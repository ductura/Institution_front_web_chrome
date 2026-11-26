// VIZ alat (graditelj): which prototype screen each app screen is compared
// with. The app screens are the a11y list (e2e/a11y/screens.ts), so a new
// screen there is one line here. The prototypes are in docs/prototip
// (or VIZ_PROTOTIPOVI); a screen without a pair is
// shot from the app only.
import { resolve } from "node:path";

import { imeScenarija } from "../../test-fakes/viz-scenariji";
import { ASSIGNMENT_ID as ASSIGNMENT, COURSE_ID } from "../a11y/fake-server";
import { SCREENS, type Screen } from "../a11y/screens";
import { pairScreens } from "./ekrani";

/** The prototype file under VIZ_PROTOTIPOVI and its hash route. */
export type Proto = { readonly file: string; readonly hash?: string };

const S = "Ductura_student.html";
const N = "Ductura_nastavnik.html";
const E = "editor/index.html";

const PROTO: Readonly<Record<string, Proto>> = {
  "student: moji zadaci": { file: S, hash: "pocetna" },
  "student: moji kolegiji": { file: S, hash: "kolegiji" },
  "student: moji radovi": { file: S, hash: "radovi" },
  "student: upis kodom": { file: S, hash: "upis" },
  "student: upis u kolegij": { file: S, hash: "upis" },
  "student: zadatak": { file: S, hash: "obavijest" },
  "student: radni prostor": { file: E },
  "student: rad": { file: E },
  "student: predaja, izjava": { file: S, hash: "predaja" },
  "student: predaja, izjava o radu": { file: S, hash: "izjava" },
  "student: predaja, pregled": { file: S, hash: "pregled" },
  "student: predaja, potvrda": { file: S, hash: "potvrda" },
  "nastavnik: kolegiji": { file: N, hash: "kolegiji" },
  "nastavnik: brz put": { file: N, hash: "brz-put" },
  "nastavnik: mentorstva": { file: N, hash: "mentorstva" },
  "nastavnik: zbirni pregled": { file: N, hash: "zbirni" },
  "nastavnik: novi zadatak": { file: N, hash: "novi-zadatak" },
  "nastavnik: nova verzija zadatka": { file: N, hash: "novi-zadatak" },
  "nastavnik: produljenje roka": { file: N, hash: "produljenje" },
  "nastavnik: rad studenta": { file: N, hash: "rad" },
  "nastavnik: predaja": { file: N, hash: "predaja" },
  "nastavnik: reprodukcija": { file: N, hash: "reprodukcija" },
  "nastavnik: konzultacije": { file: N, hash: "konzultacije" },
  // Prototype screens whose route is not in the a11y list (VIZ-TAMNA): EXTRA below.
  "nastavnik: popis studenata": { file: N, hash: "studenti" },
  "nastavnik: sažetak i karta podrijetla": { file: N, hash: "sazetak" },
  "nastavnik: usporedba verzija": { file: N, hash: "usporedba" },
  "nastavnik: izvoz za Merlin": { file: N, hash: "izvoz" },
};

/**
 * Screens of the app that the a11y list (e2e/a11y/screens.ts, not this tool's)
 * does not have, so that every prototype screen with a page (INVENTAR-nastavnik
 * N-04, N-10, N-11, N-18) has a pair. The routes are those of src/routes.ts.
 */
const EXTRA: readonly Screen[] = [
  { name: "nastavnik: popis studenata", path: `/nastavnik/kolegiji/${COURSE_ID}/studenti`, role: "teacher" },
  { name: "nastavnik: sažetak i karta podrijetla", path: `/nastavnik/rad/${ASSIGNMENT}/sazetak`, role: "teacher" },
  { name: "nastavnik: usporedba verzija", path: `/nastavnik/rad/${ASSIGNMENT}/usporedba`, role: "teacher" },
  { name: "nastavnik: izvoz za Merlin", path: `/nastavnik/zadatak/${ASSIGNMENT}/merlin`, role: "teacher" },
];

export type Pair = { readonly screen: Screen; readonly proto: Proto | null; readonly slug: string };

/** A file name of the screen: "student: predaja, pregled" → "student-predaja-pregled". */
export const slug = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PAIRS: readonly Pair[] = pairScreens(SCREENS, EXTRA).map((screen) => ({ screen, proto: PROTO[screen.name] ?? null, slug: slug(screen.name) }));

/** The prototype breakpoints are 640, 1050 and 1250 px; one width inside each range (GRADITELJ.md). */
export const WIDTHS = [390, 768, 1100, 1280] as const;

/**
 * The scenario of the fake server both shots are taken in (VIZ_SCENARIJ): puno
 * (default; the prototype's state "puno"), prazno, ucitavanje, greska or
 * dugi-tekst. Shots of other scenarios go to viz-out/<scenario>/.
 */
export const SCENARIJ = imeScenarija(process.env.VIZ_SCENARIJ);

/** The theme of the pass (VIZ_THEME): light (default) or dark (VIZ-TAMNA, same threshold, same widths). */
export type Tema = "light" | "dark";
export const TEME: readonly Tema[] = ["light", "dark"];
export const THEME: Tema = process.env.VIZ_THEME === "dark" ? "dark" : "light";

/** The folder of a scenario: viz-out for "puno", viz-out/<scenario> for the others. */
export const SCENARIJ_OUT = resolve(import.meta.dirname, "../../viz-out") + (SCENARIJ === "puno" ? "" : `/${SCENARIJ}`);
/** The folder of a theme: light shots stay in the scenario folder, dark ones go in its subfolder "dark". */
export const temaOut = (tema: Tema) => (tema === "dark" ? `${SCENARIJ_OUT}/dark` : SCENARIJ_OUT);
/** The folder of the shots and the report of this pass. */
export const VIZ_OUT = temaOut(THEME);
