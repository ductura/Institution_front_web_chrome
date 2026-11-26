// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Download } from "./Download";
import { EDGE_SIGN_IN, openEdgeSignIn } from "./edge";
import { Landing } from "./Landing";

// DAN-1574: the three sign-in buttons lead to the edge path /prijava (the
// preloader, Preloader#64), never under the base, and the landing has no link
// to the administration.
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe("landing sign-in buttons (DAN-1574)", () => {
  for (const base of ["/app/web", "/app/chrome", ""]) {
    it(`point at the edge /prijava under base "${base}"`, () => {
      const links = hrefs(renderToStaticMarkup(createElement(Landing, { base })));
      expect(links.filter((h) => h === EDGE_SIGN_IN)).toHaveLength(3);
      expect(links.filter((h) => h?.endsWith("/prijava") && h !== EDGE_SIGN_IN)).toEqual([]);
    });
  }

  it("the Download link goes to the edge too", () => {
    expect(hrefs(renderToStaticMarkup(createElement(Download, { base: "/app/web" })))).toContain("/prijava");
  });

  it("has no link to the administration", () => {
    const links = hrefs(renderToStaticMarkup(createElement(Landing, { base: "/app/web" })));
    expect(links.filter((h) => /admin|ustanova|operater/.test(h ?? ""))).toEqual([]);
  });
});

describe("openEdgeSignIn", () => {
  const event = (over: object = {}) => ({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn(), ...over });
  it("takes a plain click as a full page load of the edge path", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const e = event();
    openEdgeSignIn(e as never);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/prijava");
    const other = event({ ctrlKey: true });
    openEdgeSignIn(other as never);
    expect(other.preventDefault).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
