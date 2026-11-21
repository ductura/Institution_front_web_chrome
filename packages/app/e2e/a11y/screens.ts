// The main screens of the institution front (WEB-1805, M11.6): every page of
// each role's navigation, the public pages and the pages reached from them,
// with the role whose session opens it. Ids are invented.
import { ASSIGNMENT_ID, COURSE_ID, type Role } from "./fake-server";

export type Screen = { readonly name: string; readonly path: string; readonly role: Role };

const A = ASSIGNMENT_ID;
/** An invented document id for the teacher's work language exception. */
const D = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01";

export const SCREENS: readonly Screen[] = [
  // Public: no session is read. /prijava is left out: it hands the browser to AAI@EduHr at once (D-09).
  { name: "stanje sustava", path: "/stanje", role: null },
  { name: "nema ovlasti", path: "/nema-ovlasti?kind=denied", role: null },
  { name: "prijava istekla", path: "/nema-ovlasti?kind=expired", role: null },
  { name: "izjava o pristupačnosti", path: "/pristupacnost", role: null },
  // Student.
  { name: "student: moji zadaci", path: "/zadaci", role: "student" },
  { name: "student: moji kolegiji", path: "/zadaci/kolegiji", role: "student" },
  { name: "student: moji radovi", path: "/zadaci/radovi", role: "student" },
  { name: "student: radni prostor", path: "/rad", role: "student" },
  { name: "student: zahtjev za mentorstvo", path: "/zadaci/mentorstvo", role: "student" },
  { name: "student: upis kodom", path: "/upis", role: "student" },
  { name: "student: upis u kolegij", path: `/upis/kolegij/${COURSE_ID}`, role: "student" },
  { name: "student: zadatak", path: `/zadatak/${A}`, role: "student" },
  { name: "student: rad", path: `/rad/${A}`, role: "student" },
  { name: "student: predaja, izjava", path: `/rad/${A}/predaja`, role: "student" },
  { name: "student: predaja, izjava o radu", path: `/rad/${A}/predaja/izjava`, role: "student" },
  { name: "student: predaja, pregled", path: `/rad/${A}/predaja/pregled`, role: "student" },
  { name: "student: predaja, slanje", path: `/rad/${A}/predaja/slanje`, role: "student" },
  { name: "student: predaja, potvrda", path: `/rad/${A}/predaja/potvrda`, role: "student" },
  { name: "student: dnevnik pristupa", path: `/rad/${A}/dnevnik-pristupa`, role: "student" },
  { name: "student: reprodukcija", path: `/rad/${A}/reprodukcija`, role: "student" },
  { name: "student: kako Ductura radi", path: "/kako-radi", role: "student" },
  { name: "student: postavke profila", path: "/profil", role: "student" },
  // Teacher.
  { name: "nastavnik: kolegiji", path: "/nastavnik", role: "teacher" },
  { name: "nastavnik: brz put", path: "/nastavnik/brz-put", role: "teacher" },
  { name: "nastavnik: mentorstva", path: "/nastavnik/mentorstva", role: "teacher" },
  { name: "nastavnik: zbirni pregled", path: "/nastavnik/zbirni", role: "teacher" },
  { name: "nastavnik: novi zadatak", path: "/nastavnik/zadatak/novi", role: "teacher" },
  { name: "nastavnik: nova verzija zadatka", path: `/nastavnik/zadatak/${A}/uredi`, role: "teacher" },
  { name: "nastavnik: produljenje roka", path: `/nastavnik/zadatak/${A}/produljenje`, role: "teacher" },
  { name: "nastavnik: jezik rada", path: `/nastavnik/zadatak/${A}/rad/${D}/jezik`, role: "teacher" },
  { name: "nastavnik: rad studenta", path: `/nastavnik/rad/${A}`, role: "teacher" },
  { name: "nastavnik: predaja", path: `/nastavnik/rad/${A}/predaja`, role: "teacher" },
  { name: "nastavnik: reprodukcija", path: `/nastavnik/rad/${A}/reprodukcija`, role: "teacher" },
  { name: "nastavnik: konzultacije", path: `/nastavnik/rad/${A}/konzultacije`, role: "teacher" },
  { name: "nastavnik: postavke profila", path: "/profil", role: "teacher" },
  // Institution administrator.
  { name: "administrator: ustanova", path: "/ustanova", role: "institution_admin" },
  { name: "administrator: kolegiji", path: "/ustanova/kolegiji", role: "institution_admin" },
  { name: "administrator: korisnici", path: "/ustanova/korisnici", role: "institution_admin" },
  { name: "administrator: pravila", path: "/ustanova/pravila", role: "institution_admin" },
  { name: "administrator: čuvanje podataka", path: "/ustanova/cuvanje", role: "institution_admin" },
];
