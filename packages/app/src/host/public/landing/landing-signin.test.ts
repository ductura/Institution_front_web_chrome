// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Download } from "./Download";
import { EDGE_LINK, EDGE_SIGN_IN } from "./edge";
import { Landing } from "./Landing";

// DAN-1574: the three sign-in buttons lead to the edge path /prijava (the
// preloader, Preloader#64), never under the base, and the landing has no link
// to the administration.
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe("landing sign-in buttons (DAN-1574)", () => {
  for (const base of ["/aplikacija", ""]) {
    it(`point at the edge /prijava under base "${base}"`, () => {
      const links = hrefs(renderToStaticMarkup(createElement(Landing, { base })));
      expect(links.filter((h) => h === EDGE_SIGN_IN)).toHaveLength(3);
      expect(links.filter((h) => h?.endsWith("/prijava") && h !== EDGE_SIGN_IN)).toEqual([]);
    });
  }

  it("the Download link goes to the edge too", () => {
    expect(hrefs(renderToStaticMarkup(createElement(Download, { base: "/aplikacija" })))).toContain("/prijava");
  });

  it("has no link to the administration", () => {
    const links = hrefs(renderToStaticMarkup(createElement(Landing, { base: "/aplikacija" })));
    expect(links.filter((h) => /admin|ustanova|operater/.test(h ?? ""))).toEqual([]);
  });
});

describe("edge link", () => {
  it("is left to the browser by the host (target other than _self) and is a full load of /prijava", () => {
    expect(EDGE_LINK).toEqual({ href: "/prijava", target: "_top" });
    const html = renderToStaticMarkup(createElement(Landing, { base: "/aplikacija" }));
    expect(html.match(/href="\/prijava"[^>]*target="_top"|target="_top"[^>]*href="\/prijava"/g)).toHaveLength(3);
  });
});
