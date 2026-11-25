import { describe, expect, it } from "vitest";

import { ACTION_LOG, baseOf, crumbsOf, internalRoute, NO_ACCESS, OPERATOR_HOME, PROBLEM_REPORTS, PAGES, pathMatches, publicPage, resolve, routeOf, shellRole } from "./routes";

describe("baseOf and routeOf", () => {
  it("serves the same app under /app/web and /app/chrome", () => {
    expect(baseOf("/app/web/")).toBe("/app/web");
    expect(baseOf("/app/chrome/zadaci")).toBe("/app/chrome");
    expect(baseOf("/app/chrome")).toBe("/app/chrome");
    expect(baseOf("/app/chromex/zadaci")).toBe("/app/web");
  });

  it("reads the app's own path without the base or a trailing slash", () => {
    expect(routeOf("/app/web/", "/app/web")).toBe("/");
    expect(routeOf("/app/web", "/app/web")).toBe("/");
    expect(routeOf("/app/web/zadaci/kolegiji/", "/app/web")).toBe("/zadaci/kolegiji");
    expect(routeOf("/app/chrome/ustanova", "/app/chrome")).toBe("/ustanova");
  });
});

describe("shellRole", () => {
  it("maps the institution's account kinds to the shell's spaces", () => {
    expect(shellRole("institution_admin")).toBe("admin");
    expect(shellRole("teacher")).toBe("teacher");
    expect(shellRole("student")).toBe("student");
    expect(shellRole("network_engineer")).toBeNull();
    expect(shellRole(null)).toBeNull();
  });
});

describe("resolve", () => {
  it("leads / to each role's own home", () => {
    expect(resolve("/", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/", "admin")).toEqual({ kind: "redirect", to: "/ustanova" });
    expect(resolve("/", null)).toEqual({ kind: "noRole" });
  });

  it("opens every navigation item of a role for that role", () => {
    for (const page of PAGES) {
      for (const role of page.roles) expect(resolve(page.path, role)).toEqual({ kind: "page", page });
    }
    expect(resolve("/zadaci", "student")).toMatchObject({ kind: "page", page: { kind: "studentHome" } });
    expect(resolve("/zadaci/kolegiji", "student")).toMatchObject({ kind: "page", page: { kind: "studentCourses" } });
    expect(resolve("/nastavnik", "teacher")).toMatchObject({ kind: "page", page: { kind: "teacherCourses" } });
    expect(resolve("/nastavnik/mentorstva", "teacher")).toMatchObject({ kind: "page", page: { kind: "mentoredWorks" } });
    expect(resolve("/nastavnik/brz-put", "teacher")).toMatchObject({ kind: "page", page: { kind: "pending" } });
  });

  it("sends a page of another role back to the role's own home", () => {
    expect(resolve("/ustanova", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/zadaci", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/nastavnik", null)).toEqual({ kind: "redirect", to: "/" });
  });

  it("opens Kako Ductura radi for everyone and nothing else unknown", () => {
    expect(resolve("/kako-radi", null)).toMatchObject({ kind: "page" });
    expect(resolve("/kako-radi", "teacher")).toMatchObject({ kind: "page" });
    expect(resolve("/nema-ovoga", "student")).toEqual({ kind: "notFound" });
  });
});

describe("pathMatches", () => {
  it("matches a bracketed segment to any one non-empty segment", () => {
    expect(pathMatches("/zadatak/[id]", "/zadatak/izm-1")).toBe(true);
    expect(pathMatches("/rad/[assignmentId]/predaja", "/rad/a1/predaja")).toBe(true);
    expect(pathMatches("/zadatak/[id]", "/zadatak")).toBe(false);
    expect(pathMatches("/zadatak/[id]", "/zadatak/")).toBe(false);
    expect(pathMatches("/zadatak/[id]", "/zadatak/a/b")).toBe(false);
    expect(pathMatches("/rad/[assignmentId]/predaja", "/rad/a1/reprodukcija")).toBe(false);
    expect(pathMatches("/upis", "/upis")).toBe(true);
  });
});

describe("the student's pages of Ductus app/", () => {
  it("open for a student under any id, with their own label", () => {
    expect(resolve("/zadatak/izm-1", "student")).toMatchObject({ kind: "page", page: { label: "Zadatak" } });
    expect(resolve("/rad/a1/predaja", "student")).toMatchObject({ kind: "page", page: { label: "Predaja rada" } });
    expect(resolve("/zadaci/dnevnik-prakse", "student")).toMatchObject({ kind: "page", page: { label: "Dnevnik prakse", current: "/zadaci" } });
    expect(resolve("/zadaci/dnevnik-prakse", "teacher")).not.toMatchObject({ kind: "page" });
    expect(resolve("/zadatak/a1/tim", "student")).toMatchObject({ kind: "page", page: { label: "Moj tim", current: "/zadaci" } });
    expect(resolve("/zadatak/a1/tim", "teacher")).not.toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/zadatak/a1/timovi", "teacher")).toMatchObject({ kind: "page", page: { label: "Timovi na zadatku" } });
    expect(resolve("/nastavnik/zadatak/a1/timovi", "student")).not.toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/mentorstva/dnevnik-prakse", "teacher")).toMatchObject({ kind: "page", page: { current: "/nastavnik/mentorstva" } });
    expect(resolve("/nastavnik/mentorstva/dnevnik-prakse", "student")).not.toMatchObject({ kind: "page" });
    expect(resolve("/rad/a1/dnevnik-pristupa", "student")).toMatchObject({ kind: "page", page: { label: "Dnevnik pristupa" } });
    expect(resolve("/rad/a1/reprodukcija", "student")).toMatchObject({ kind: "page", page: { label: "Reprodukcija Vašeg rada" } });
    expect(resolve("/upis/kolegij/k1", "student")).toMatchObject({ kind: "page", page: { label: "Upis u kolegij", current: "/upis" } });
  });

  it("lead another role home, and leave unknown pages of them not found", () => {
    expect(resolve("/rad/a1/predaja", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/zadatak/izm-1", "teacher")).toMatchObject({ kind: "page" });
    expect(resolve("/zadatak/izm-1", "admin")).toEqual({ kind: "redirect", to: "/ustanova" });
    expect(resolve("/rad/a1/nesto", "student")).toEqual({ kind: "notFound" });
  });

  it("open in the app from a screen's link", () => {
    expect(internalRoute("/zadatak/izm-1", "/app/web")).toBe("/zadatak/izm-1");
    expect(internalRoute("/app/chrome/rad/a1/predaja", "/app/chrome")).toBe("/rad/a1/predaja");
  });
});

describe("the teacher's pages of Ductus app/", () => {
  it("open for a teacher under any id, and lead a student home", () => {
    expect(resolve("/nastavnik/rad/r1", "teacher")).toMatchObject({ kind: "page", page: { label: "Rad uživo" } });
    expect(resolve("/nastavnik/rad/r1/reprodukcija", "teacher")).toMatchObject({ kind: "page", page: { label: "Reprodukcija rada" } });
    expect(resolve("/nastavnik/zadatak/novi", "teacher")).toMatchObject({ kind: "page", page: { current: "/nastavnik" } });
    expect(resolve("/nastavnik/zadatak/z1/uredi", "teacher")).toMatchObject({ kind: "page", page: { label: "Nova verzija zadatka" } });
    expect(resolve("/nastavnik/zadatak/z1/rad/d1/jezik", "teacher")).toMatchObject({ kind: "page", page: { label: "Jezik rada jednog studenta" } });
    expect(resolve("/nastavnik/kolegiji", "teacher")).toMatchObject({ kind: "page", page: { kind: "teacherCourses" } });
    expect(resolve("/nastavnik/rad/r1", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/nastavnik/zadatak/z1", "teacher")).toEqual({ kind: "notFound" });
  });

  it("open the submissions of one assignment to a teacher only (PIL-D2-PREDAJE)", () => {
    expect(PAGES.some((p) => p.path === "/nastavnik/zadatak/[assignmentId]/predaje")).toBe(true);
    expect(resolve("/nastavnik/zadatak/z1/predaje", "teacher")).toMatchObject({ kind: "page", page: { label: "Predaje zadatka", current: "/nastavnik" } });
    expect(resolve("/nastavnik/zadatak/z1/predaje", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/nastavnik/zadatak/z1/predaje", "admin")).toEqual({ kind: "redirect", to: "/ustanova" });
    expect(resolve("/nastavnik/zadatak/z1/predaje", null)).toEqual({ kind: "redirect", to: "/" });
    expect(internalRoute("/app/web/nastavnik/zadatak/z1/predaje", "/app/web")).toBe("/nastavnik/zadatak/z1/predaje");
  });
});

describe("the course aggregate (PIL-K-ZBIRNO)", () => {
  it("is a page of PAGES for a teacher only, under the course", () => {
    expect(PAGES.some((p) => p.path === "/nastavnik/kolegiji/[courseId]/zbirno")).toBe(true);
    expect(resolve("/nastavnik/kolegiji/k1/zbirno", "teacher")).toMatchObject({ kind: "page", page: { label: "Zbirni pregled kolegija", current: "/nastavnik" } });
    expect(resolve("/nastavnik/kolegiji/k1/zbirno", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/nastavnik/kolegiji/k1/zbirno", null)).toEqual({ kind: "redirect", to: "/" });
    expect(internalRoute("/app/web/nastavnik/kolegiji/k1/zbirno", "/app/web")).toBe("/nastavnik/kolegiji/k1/zbirno");
  });
});

describe("the student data export (WEB-1302)", () => {
  it("opens for the administrator and for a signed-in account without a role of its own", () => {
    expect(resolve("/ustanova/izvoz-podataka", "admin")).toMatchObject({ kind: "page", page: { label: "Izvoz podataka studenta" } });
    expect(resolve("/ustanova/izvoz-podataka", null)).toMatchObject({ kind: "page", page: { label: "Izvoz podataka studenta" } });
  });
});

describe("the operator's page (WEB-NUZ-OPERATER, NF-7 OA-1)", () => {
  it("is the operator's home instead of the screen without a role", () => {
    expect(resolve("/", null, ["network_engineer"])).toEqual({ kind: "redirect", to: OPERATOR_HOME });
    expect(resolve("/", null, [])).toEqual({ kind: "noRole" });
    expect(resolve("/", "admin", ["institution_admin", "network_engineer"])).toEqual({ kind: "redirect", to: "/ustanova" });
  });

  it("opens for the operator's account only, whatever its shell role", () => {
    expect(resolve(OPERATOR_HOME, null, ["network_engineer"])).toMatchObject({ kind: "page", page: { label: "Mjerila pilota" } });
    expect(resolve(OPERATOR_HOME, "teacher", ["teacher", "network_engineer"])).toMatchObject({ kind: "page", page: { path: OPERATOR_HOME } });
  });

  it("refuses every other account, never leading it home", () => {
    expect(NO_ACCESS).toBe("/nema-ovlasti?kind=denied");
    expect(resolve(OPERATOR_HOME, "admin", ["institution_admin"])).toEqual({ kind: "redirect", to: NO_ACCESS });
    expect(resolve(OPERATOR_HOME, "teacher", ["teacher"])).toEqual({ kind: "redirect", to: NO_ACCESS });
    expect(resolve(OPERATOR_HOME, "student", ["student"])).toEqual({ kind: "redirect", to: NO_ACCESS });
    expect(resolve(OPERATOR_HOME, null, [])).toEqual({ kind: "redirect", to: NO_ACCESS });
    // Without the account kinds (an older caller), the page stays refused.
    expect(resolve(OPERATOR_HOME, "admin")).toEqual({ kind: "redirect", to: NO_ACCESS });
  });

  it("leads the operator from another role's page to its own home, and keeps the pages open to everyone", () => {
    expect(resolve("/ustanova", null, ["network_engineer"])).toEqual({ kind: "redirect", to: "/" });
    expect(resolve("/kako-radi", null, ["network_engineer"])).toMatchObject({ kind: "page" });
    expect(resolve("/profil", null, ["network_engineer"])).toMatchObject({ kind: "page" });
  });

  it("is a page of the host, opened in the app, not a public page", () => {
    expect(publicPage(OPERATOR_HOME)).toBeNull();
    expect(internalRoute(`/app/web${OPERATOR_HOME}`, "/app/web")).toBe(OPERATOR_HOME);
    // NF-7 OA-3, OA-7 added the two pages shared with the administrator; nothing else is kept by account kind.
    expect(PAGES.filter((p) => p.accounts !== undefined).map((p) => p.path)).toEqual([OPERATOR_HOME, ACTION_LOG, PROBLEM_REPORTS]);
  });
});

describe("the log of actions and the problem reports (NF-7 OA-3, OA-7)", () => {
  it("open for the operator and for the faculty's administrator, whatever the shell role", () => {
    for (const path of [ACTION_LOG, PROBLEM_REPORTS]) {
      expect(resolve(path, null, ["network_engineer"])).toMatchObject({ kind: "page", page: { path } });
      expect(resolve(path, "admin", ["institution_admin"])).toMatchObject({ kind: "page", page: { path } });
      expect(resolve(path, "teacher", ["teacher", "network_engineer"])).toMatchObject({ kind: "page", page: { path } });
    }
    expect(resolve(ACTION_LOG, null, ["network_engineer"])).toMatchObject({ page: { label: "Dnevnik radnji" } });
    expect(resolve(PROBLEM_REPORTS, null, ["network_engineer"])).toMatchObject({ page: { label: "Prijave problema" } });
  });

  it("refuse a teacher, a student and an account without a kind, never leading them home", () => {
    for (const path of [ACTION_LOG, PROBLEM_REPORTS]) {
      expect(resolve(path, "teacher", ["teacher"])).toEqual({ kind: "redirect", to: NO_ACCESS });
      expect(resolve(path, "student", ["student"])).toEqual({ kind: "redirect", to: NO_ACCESS });
      expect(resolve(path, null, [])).toEqual({ kind: "redirect", to: NO_ACCESS });
      expect(publicPage(path)).toBeNull();
    }
  });
});

describe("publicPage", () => {
  it("gives the pages opened without a session: Stanje sustava, Prijava and Nema ovlasti", () => {
    expect(publicPage("/stanje")).toMatchObject({ label: "Stanje sustava" });
    expect(publicPage("/prijava")).toMatchObject({ label: "Prijava" });
    expect(publicPage("/nema-ovlasti")).toMatchObject({ label: "Nema ovlasti" });
    expect(publicPage("/izvoz-podataka/izmisljeni-token")).toMatchObject({ label: "Izvoz mojih podataka" });
    expect(publicPage("/provjera")).toMatchObject({ label: "Provjera potvrde" });
    expect(publicPage("/izvoz-podataka")).toBeNull();
    expect(publicPage("/ustanova/izvoz-podataka")).toBeNull();
    expect(publicPage("/zadaci")).toBeNull();
    expect(publicPage("/kako-radi")).toBeNull();
    expect(publicPage("/")).toBeNull();
  });
});

describe("crumbsOf", () => {
  it("gives the role's home no crumb and other pages their label", () => {
    const home = PAGES.find((p) => p.path === "/zadaci")!;
    const courses = PAGES.find((p) => p.path === "/zadaci/kolegiji")!;
    expect(crumbsOf(home, "student")).toEqual([]);
    expect(crumbsOf(courses, "student")).toEqual([courses.label]);
  });
});

describe("internalRoute", () => {
  it("opens the shell's links and the screens' links in the app", () => {
    expect(internalRoute("/app/web/zadaci", "/app/web")).toBe("/zadaci");
    expect(internalRoute("/app/web/", "/app/web")).toBe("/");
    expect(internalRoute("/zadaci/kolegiji", "/app/chrome")).toBe("/zadaci/kolegiji");
    // WEB-2111: the receipt's link to the check keeps the QR fragment.
    expect(internalRoute("/app/web/provjera#r=a&o=b", "/app/web")).toBe("/provjera#r=a&o=b");
    expect(internalRoute("/upis?kod=1#x", "/app/web")).toBe("/upis");
    expect(internalRoute("/", "/app/web")).toBe("/");
  });

  it("leaves other origins, the admin and the server to the browser", () => {
    expect(internalRoute("https://example.org/zadaci", "/app/web")).toBeNull();
    expect(internalRoute("//example.org/zadaci", "/app/web")).toBeNull();
    expect(internalRoute("/admin/prijava", "/app/web")).toBeNull();
    expect(internalRoute("/app/chrome/zadaci", "/app/web")).toBeNull();
    expect(internalRoute("#sadrzaj", "/app/web")).toBeNull();
  });
});
