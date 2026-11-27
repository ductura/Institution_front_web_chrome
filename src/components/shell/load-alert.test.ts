import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";

import LoadAlert, { DeniedState, NotFoundState } from "./LoadAlert";

const css = readFileSync(new URL("./LoadAlert.module.css", import.meta.url), "utf8");

describe("LoadAlert (design alignment 27. 11. 2026., A2)", () => {
  it("is one role=alert frame with the caller's text and no link without retry", () => {
    const html = renderToStaticMarkup(createElement(LoadAlert, null, t.teacherCourses.unavailable));
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain(t.teacherCourses.unavailable);
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<button");
  });

  it("puts \"Pokušaj ponovno\" under the frame, outside it", () => {
    const html = renderToStaticMarkup(
      createElement(LoadAlert, { retry: { label: t.teacherCourses.retry, href: "/nastavnik" } }, t.teacherCourses.unavailable),
    );
    const alertEnd = html.indexOf("</p>");
    const link = html.indexOf('href="/nastavnik"');
    expect(alertEnd).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(alertEnd);
    expect(html).toContain(`>${t.teacherCourses.retry}</a>`);
  });

  it("offers a button when the retry reads again in place", () => {
    const html = renderToStaticMarkup(
      createElement(LoadAlert, { retry: { label: t.teacherCourses.retry, onRetry: () => {} } }, t.teacherCourses.unavailable),
    );
    expect(html).toContain('<button type="button"');
    expect(html).toContain(t.teacherCourses.retry);
  });

  it("403 shows only the heading and the way back to one's own space", () => {
    const html = renderToStaticMarkup(createElement(DeniedState, { backHref: "/nastavnik" }));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(t.access.deniedTitle);
    expect(html).toContain(`href="/nastavnik">${t.access.backToOwn}</a>`);
    expect(html).not.toContain(t.access.deniedBody);
    expect(html).not.toContain('role="alert"');
  });

  it("404 shows \"Stranica ne postoji\", not a read error", () => {
    const html = renderToStaticMarkup(createElement(NotFoundState, null));
    expect(html).toContain(t.errorPage.notFoundTitle);
    expect(html).not.toContain('role="alert"');
  });

  it("draws the edge and the text in the error colour, with no error-soft fill", () => {
    expect(css).toMatch(/border:\s*1px solid var\(--error\)/);
    expect(css).toMatch(/color:\s*var\(--error\)/);
    expect(css).toContain("var(--radius-sm)");
    expect(css).toMatch(/padding:\s*10px 12px/);
    expect(css).not.toContain("--error-soft");
  });
});
