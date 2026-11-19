import { describe, expect, it } from "vitest";

import { baseOf, crumbsOf, internalRoute, PAGES, pathMatches, publicPage, resolve, routeOf, shellRole } from "./routes";

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
});

describe("publicPage", () => {
  it("gives the pages opened without a session: Stanje sustava and Prijava", () => {
    expect(publicPage("/stanje")).toMatchObject({ label: "Stanje sustava" });
    expect(publicPage("/prijava")).toMatchObject({ label: "Prijava" });
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
