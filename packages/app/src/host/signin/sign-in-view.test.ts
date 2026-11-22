import { describe, expect, it } from "vitest";

import { signInViewOf } from "./sign-in-view";

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
});
