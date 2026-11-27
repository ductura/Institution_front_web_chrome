// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Download, SiteFooter } from "./Download";
import { EDGE_FOOTER, EDGE_LINK, EDGE_SIGN_IN } from "./edge";
import { Landing } from "./Landing";
import { SiteHeader } from "./SiteHeader";

// DAN-1574 (address map D-318, Preloader#64): sign-in, logo, download and footer
// links lead to the edge's absolute paths, never under the base, and the landing
// has no link to the administration.
const anchors = (html: string) =>
  [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: /href="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
    target: /target="([^"]*)"/.exec(m[1] ?? "")?.[1],
    text: (m[2] ?? "").replace(/<[^>]*>/g, "").trim(),
  }));
const hrefs = (html: string) => anchors(html).map((a) => a.href);

describe("landing links (DAN-1574)", () => {
  for (const base of ["/app/web", "/app/chrome", ""]) {
    it(`sign-in buttons lead to /ulaz under base "${base}"`, () => {
      const links = hrefs(renderToStaticMarkup(createElement(Landing, { base })));
      expect(links.filter((h) => h === EDGE_SIGN_IN)).toHaveLength(3);
      expect(links.filter((h) => h.endsWith("/ulaz") && h !== EDGE_SIGN_IN)).toEqual([]);
      expect(links.filter((h) => h.includes("/prijava"))).toEqual([]);
      expect(links.filter((h) => h.startsWith("/app") || h.includes("naslovnica"))).toEqual([]);
    });
  }

  it("the Download link to the browser goes to /ulaz too", () => {
    expect(hrefs(renderToStaticMarkup(createElement(Download)))).toContain("/ulaz");
  });

  it("the header logo goes to / and Preuzmi to /preuzimanja", () => {
    const a = anchors(renderToStaticMarkup(createElement(SiteHeader)));
    expect(a[0]).toMatchObject({ href: "/", target: "_top" });
    expect(a.find((x) => x.href === "/preuzimanja")).toMatchObject({ target: "_top" });
    expect(a.filter((x) => x.href === "#preuzmi")).toEqual([]);
  });

  it("the Download buttons Preuzmi lead to /preuzimanja", () => {
    const a = anchors(renderToStaticMarkup(createElement(Download)));
    expect(a.filter((x) => x.href === "/preuzimanja")).toHaveLength(2);
    expect(a.filter((x) => x.href === "#")).toEqual([]);
  });

  it("the footer: logo to /, six links to the absolute edge paths", () => {
    const a = anchors(renderToStaticMarkup(createElement(SiteFooter)));
    expect(a[0]).toMatchObject({ href: "/", target: "_top" });
    expect(a.slice(1).map((x) => x.href)).toEqual([
      "/pomoc",
      "/kontakt",
      "/privatnost",
      "/uvjeti-koristenja",
      "/pristupacnost",
      "/stanje",
    ]);
    expect(a.every((x) => x.target === "_top")).toBe(true);
    expect(Object.values(EDGE_FOOTER)).toHaveLength(6);
  });

  it("has no link to the administration", () => {
    const links = hrefs(renderToStaticMarkup(createElement(Landing, { base: "/app/web" })));
    expect(links.filter((h) => /admin|ustanova|operater/.test(h))).toEqual([]);
  });
});

describe("edge link", () => {
  it("is left to the browser by the host (target other than _self) and is a full load of /ulaz", () => {
    expect(EDGE_LINK).toEqual({ href: "/ulaz", target: "_top" });
    const html = renderToStaticMarkup(createElement(Landing, { base: "/app/web" }));
    expect(html.match(/href="\/ulaz"[^>]*target="_top"|target="_top"[^>]*href="\/ulaz"/g)).toHaveLength(3);
  });
});
