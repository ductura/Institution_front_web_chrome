import { describe, expect, it } from "vitest";

import { footerLinks, signInViewOf, skipTarget } from "./sign-in-view";

const of = (query: string) => signInViewOf(new URLSearchParams(query));

describe("signInViewOf", () => {
  it("is the plain sign-in without a query or with an unknown one", () => {
    expect(of("")).toBe("signIn");
    expect(of("stanje=nepoznato&greska=x")).toBe("signIn");
    expect(of("stanje=toString&greska=constructor")).toBe("signIn");
  });
  it("reads every stanje of the prototype", () => {
    expect(of("stanje=odjava")).toBe("signedOut");
    expect(of("stanje=istekla")).toBe("expired");
    expect(of("stanje=greska")).toBe("failed");
    expect(of("stanje=nedostupno")).toBe("unavailable");
    expect(of("stanje=bezuloge")).toBe("noRole");
    expect(of("stanje=pomoc")).toBe("help");
  });
  it("maps the login route's error codes, which win over stanje", () => {
    expect(of("greska=login_failed")).toBe("failed");
    expect(of("greska=provider_unavailable")).toBe("unavailable");
    expect(of("stanje=pomoc&greska=login_failed")).toBe("failed");
  });
  it("tells a refused sign-in (login_refused, P-15) apart from a fault and from no role", () => {
    expect(of("greska=login_refused")).toBe("refused");
    expect(of("stanje=odbijeno")).toBe("refused");
    expect(of("stanje=bezuloge&greska=login_refused")).toBe("refused");
    expect(of("greska=provider_unavailable")).not.toBe(of("greska=login_refused"));
  });
});

describe("footerLinks (KA-05-WEB)", () => {
  const links = footerLinks((path) => `/aplikacija${path}`);
  it("lists Pomoć, Kontakt, Privatnost, Uvjeti, Pristupačnost and Stanje in that order", () => {
    expect(links.map((l) => l.key)).toEqual(["help", "contact", "privacy", "terms", "accessibility", "status"]);
  });
  it("puts the public pages under the base and leaves pages that do not exist without an href", () => {
    expect(links.find((l) => l.key === "status")?.href).toBe("/aplikacija/stanje");
    expect(links.find((l) => l.key === "accessibility")?.href).toBe("/aplikacija/pristupacnost");
    expect(links.find((l) => l.key === "contact")?.href).toBeNull();
    expect(links.find((l) => l.key === "terms")?.href).toBeNull();
  });
});

describe("skipTarget (GET /api/v1/me)", () => {
  it("skips the screen only for a signed-in session", () => {
    expect(skipTarget({ kind: "signedIn" }, "/aplikacija/")).toBe("/aplikacija/");
    for (const kind of ["signedOut", "unavailable"]) expect(skipTarget({ kind }, "/aplikacija/")).toBeNull();
  });
});
