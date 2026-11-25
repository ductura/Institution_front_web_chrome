// The main screens of the institution front (WEB-1805, M11.6): every page of
// each role's navigation, the public pages and the pages reached from them,
// with the role whose session opens it. Ids are invented; they are the ids the
// fake server's "puno" scenario (test-fakes/viz-scenariji.ts) answers with data.
import { ASSIGNMENT_ID, COURSE_ID, type Role } from "./fake-server";

export type Screen = { readonly name: string; readonly path: string; readonly role: Role };

const A = ASSIGNMENT_ID;
/** An invented document id for the teacher's work language exception. */
const D = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01";
/** The submitted task of "puno" (Kolegij C): the pages after a submission have a receipt to show. */
const SUBMITTED = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03";
/** The document of the contract's submission receipt: the teacher's submission view matches it to the work. */
const RECEIPT_DOCUMENT = "izmisljeni-rad-predaje-0001";
/** The teacher's own course of "puno" (teacher.courses.get). */
const TEACHER_COURSE = "2c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e01";

export const SCREENS: readonly Screen[] = [
  // Public: no session is read.
  { name: "prijava", path: "/prijava", role: null },
  { name: "nepostojeća stranica", path: "/nepostojeca-stranica", role: "student" },
  { name: "stanje sustava", path: "/stanje", role: null },
  { name: "provjera potvrde", path: "/provjera", role: null },
  { name: "nema ovlasti", path: "/nema-ovlasti?kind=denied", role: null },
  { name: "prijava istekla", path: "/nema-ovlasti?kind=expired", role: null },
  { name: "izjava o pristupačnosti", path: "/pristupacnost", role: null },
  { name: "preuzimanje izvoza podataka", path: "/izvoz-podataka/IzmisljeniTokenZaProvjeruPristupacnosti_001", role: null },
  // Student.
  { name: "student: moji zadaci", path: "/zadaci", role: "student" },
  { name: "student: moji kolegiji", path: "/zadaci/kolegiji", role: "student" },
  { name: "student: moji radovi", path: "/zadaci/radovi", role: "student" },
  { name: "student: radni prostor", path: "/rad", role: "student" },
  { name: "student: zahtjev za mentorstvo", path: "/zadaci/mentorstvo", role: "student" },
  { name: "student: dnevnik prakse", path: "/zadaci/dnevnik-prakse", role: "student" },
  { name: "student: upis kodom", path: "/upis", role: "student" },
  { name: "student: upis u kolegij", path: `/upis/kolegij/${COURSE_ID}`, role: "student" },
  { name: "student: zadatak", path: `/zadatak/${A}`, role: "student" },
  { name: "student: rad", path: `/rad/${A}`, role: "student" },
  { name: "student: predaja, izjava", path: `/rad/${A}/predaja`, role: "student" },
  { name: "student: predaja, izjava o radu", path: `/rad/${A}/predaja/izjava`, role: "student" },
  { name: "student: predaja, pregled", path: `/rad/${A}/predaja/pregled`, role: "student" },
  { name: "student: predaja, slanje", path: `/rad/${A}/predaja/slanje`, role: "student" },
  { name: "student: predaja, potvrda", path: `/rad/${SUBMITTED}/predaja/potvrda`, role: "student" },
  { name: "student: dnevnik pristupa", path: `/rad/${SUBMITTED}/dnevnik-pristupa`, role: "student" },
  { name: "student: reprodukcija", path: `/rad/${A}/reprodukcija`, role: "student" },
  { name: "student: podrijetlo teksta", path: `/rad/${SUBMITTED}/podrijetlo`, role: "student" },
  { name: "student: razgovor o radu", path: `/rad/${A}/razgovor`, role: "student" },
  { name: "student: kako Ductura radi", path: "/kako-radi", role: "student" },
  { name: "student: postavke profila", path: "/profil", role: "student" },
  // Operator (WEB-NUZ-OPERATER): its own page in the host, no longer public.
  { name: "operater: mjerila pilota", path: "/operater/mjerila-pilota", role: "network_engineer" },
  // Teacher.
  { name: "nastavnik: kolegiji", path: "/nastavnik", role: "teacher" },
  { name: "nastavnik: moji kolegiji", path: "/nastavnik/kolegiji", role: "teacher" },
  { name: "nastavnik: studenti kolegija", path: `/nastavnik/kolegiji/${TEACHER_COURSE}/studenti`, role: "teacher" },
  { name: "nastavnik: zbirno po kolegiju", path: `/nastavnik/kolegiji/${TEACHER_COURSE}/zbirno`, role: "teacher" },
  { name: "nastavnik: brz put", path: "/nastavnik/brz-put", role: "teacher" },
  { name: "nastavnik: mentorstva", path: "/nastavnik/mentorstva", role: "teacher" },
  { name: "nastavnik: zbirni pregled", path: "/nastavnik/zbirni", role: "teacher" },
  { name: "nastavnik: novi zadatak", path: "/nastavnik/zadatak/novi", role: "teacher" },
  { name: "nastavnik: nova verzija zadatka", path: `/nastavnik/zadatak/${A}/uredi`, role: "teacher" },
  { name: "nastavnik: produljenje roka", path: `/nastavnik/zadatak/${A}/produljenje`, role: "teacher" },
  { name: "nastavnik: jezik rada", path: `/nastavnik/zadatak/${A}/rad/${D}/jezik`, role: "teacher" },
  { name: "nastavnik: rad studenta", path: `/nastavnik/rad/${A}`, role: "teacher" },
  { name: "nastavnik: predaja", path: `/nastavnik/rad/${RECEIPT_DOCUMENT}/predaja`, role: "teacher" },
  { name: "nastavnik: reprodukcija", path: `/nastavnik/rad/${A}/reprodukcija`, role: "teacher" },
  { name: "nastavnik: konzultacije", path: `/nastavnik/rad/${A}/konzultacije`, role: "teacher" },
  { name: "nastavnik: priprema razgovora", path: `/nastavnik/rad/${A}/priprema-razgovora`, role: "teacher" },
  { name: "nastavnik: sažetak rada", path: `/nastavnik/rad/${A}/sazetak`, role: "teacher" },
  { name: "nastavnik: usporedba verzija", path: `/nastavnik/rad/${A}/usporedba`, role: "teacher" },
  { name: "nastavnik: Merlin", path: `/nastavnik/zadatak/${A}/merlin`, role: "teacher" },
  { name: "nastavnik: predaje zadatka", path: `/nastavnik/zadatak/${A}/predaje`, role: "teacher" },
  { name: "nastavnik: postavke profila", path: "/profil", role: "teacher" },
  // Institution administrator.
  { name: "administrator: ustanova", path: "/ustanova", role: "institution_admin" },
  { name: "administrator: kolegiji", path: "/ustanova/kolegiji", role: "institution_admin" },
  { name: "administrator: korisnici", path: "/ustanova/korisnici", role: "institution_admin" },
  { name: "administrator: pravila", path: "/ustanova/pravila", role: "institution_admin" },
  { name: "administrator: pragovi po vrsti podrijetla", path: "/ustanova/pragovi", role: "institution_admin" },
  { name: "administrator: postavke fakulteta", path: "/ustanova/postavke", role: "institution_admin" },
  { name: "administrator: asistent na fakultetu", path: "/ustanova/postavke/asistent", role: "institution_admin" },
  { name: "student: moja prava", path: "/moja-prava", role: "student" },
  { name: "administrator: čuvanje podataka", path: "/ustanova/cuvanje", role: "institution_admin" },
  { name: "administrator: izvoz podataka studenta", path: "/ustanova/izvoz-podataka", role: "institution_admin" },
  { name: "administrator: dnevnik radnji", path: "/operater/dnevnik-radnji", role: "institution_admin" },
  { name: "administrator: prijave problema", path: "/operater/prijave-problema", role: "institution_admin" },
];
