import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { messagesHr } from "../../../../../../locales/hr.ts";
import { messagesEn } from "../../../../../../locales/en.ts";

import { AboutView } from "./AboutView";
import { demoHref, SHOTS, shotSrc } from "./demo-link";

const render = (demoUrl: string | null) =>
  renderToStaticMarkup(createElement(AboutView, { t: messagesHr.landing, signInHref: "/app/web/prijava", demoUrl }));

describe("demoHref (DEMO-1)", () => {
  it("takes an absolute http(s) address", () => {
    expect(demoHref("https://demo.example.test/app/web")).toBe("https://demo.example.test/app/web");
    expect(demoHref("  http://localhost:8000/  ")).toBe("http://localhost:8000/");
  });
  it("hides the button when the build has no demo or a wrong address", () => {
    expect(demoHref(undefined)).toBeNull();
    expect(demoHref("")).toBeNull();
    expect(demoHref("   ")).toBeNull();
    expect(demoHref("/app/web")).toBeNull();
    expect(demoHref("javascript:alert(1)")).toBeNull();
  });
});

describe("AboutView (DEMO-1)", () => {
  it("shows the demo button only when the build has a demo address", () => {
    const withDemo = render("https://demo.example.test/");
    expect(withDemo).toContain('href="https://demo.example.test/"');
    expect(withDemo).toContain(messagesHr.landing.demo.tryButton);
    const without = render(null);
    expect(without).not.toContain(messagesHr.landing.demo.tryButton);
    expect(without).not.toContain("demo.example.test");
  });
  it("has one h1, a skip target and every screenshot with its own alt text", () => {
    const html = render(null);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('id="sadrzaj"');
    for (const shot of SHOTS) {
      expect(html).toContain(`src="${shotSrc(shot)}"`);
      expect(html).toContain(`alt="${messagesHr.landing.demo.shots[shot]}"`);
    }
    expect(html).toContain('href="/app/web/prijava"');
  });
  it("uses no forbidden term in either language", () => {
    expect(findForbiddenTerms(JSON.stringify(messagesHr.landing.demo))).toEqual([]);
    expect(findForbiddenTerms(JSON.stringify(messagesEn.landing.demo))).toEqual([]);
    expect(findForbiddenTerms(render("https://demo.example.test/").replace(/<[^>]+>/g, " "))).toEqual([]);
  });
});
