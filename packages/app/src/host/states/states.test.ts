// WEB-DIZ-S-ZAJEDNICKO (Ductus#2059 c.7214951129, dio A): the shared states and the tab's title.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../../../locales/hr.ts";
import { documentTitle } from "./document-title";
import { DeniedState, LoadAlert, NotFoundState } from "./States";

const CSS = readFileSync(resolve(__dirname, "States.module.css"), "utf8");
const rule = (selector: string) => {
  const at = CSS.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return CSS.slice(at, CSS.indexOf("}", at));
};

describe("documentTitle (A4)", () => {
  it("joins the heading and the app's name with a comma, never with a middle dot", () => {
    expect(documentTitle("Stranica ne postoji", "Ductura")).toBe("Stranica ne postoji, Ductura");
    expect(documentTitle(t.errorPage.notFoundTitle, t.app.name)).not.toContain("·");
  });

  it("leaves the app's name alone with no heading", () => {
    expect(documentTitle(null, "Ductura")).toBe("Ductura");
    expect(documentTitle(undefined, "Ductura")).toBe("Ductura");
    expect(documentTitle("  ", "Ductura")).toBe("Ductura");
  });
});

describe("LoadAlert (A2)", () => {
  it("is one role=alert frame with the title and the body, and the retry link under it, outside the frame", () => {
    const html = renderToStaticMarkup(
      createElement(LoadAlert, { title: "Prikaz trenutačno nije dostupan.", body: "Podaci se nisu učitali.", retry: { label: "Pokušaj ponovno", href: "/aplikacija/radovi" } }),
    );
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    const frame = html.slice(html.indexOf('role="alert"'), html.indexOf("</div>"));
    expect(frame).toContain("Prikaz trenutačno nije dostupan.");
    expect(frame).toContain("Podaci se nisu učitali.");
    expect(frame).not.toContain("Pokušaj ponovno");
    expect(html).toMatch(/<a class="[^"]+" href="\/aplikacija\/radovi">Pokušaj ponovno<\/a>/);
  });

  it("reads again through a button styled as the same link when the caller passes a callback", () => {
    const html = renderToStaticMarkup(createElement(LoadAlert, { body: "Nije moguće učitati.", retry: { label: "Pokušaj ponovno", onRetry: () => undefined } }));
    expect(html).toMatch(/<button type="button" class="[^"]+">Pokušaj ponovno<\/button>/);
    expect(html).not.toContain("<a ");
  });

  it("shows only the frame without a retry, and without a title line when none is given", () => {
    const html = renderToStaticMarkup(createElement(LoadAlert, { body: "Nije moguće učitati." }));
    expect(html.startsWith('<div role="alert"')).toBe(true);
    expect(html.match(/<p/g)).toHaveLength(1);
  });

  it("draws a 1 px edge in the error colour, radius 4, padding 10/12 and no fill; the link is an underlined accent", () => {
    const alert = rule(".alert");
    expect(alert).toContain("border: 1px solid var(--color-error);");
    expect(alert).toContain("border-radius: var(--radius-sm);");
    expect(alert).toContain("padding: 10px 12px;");
    expect(alert).toContain("background: none;");
    expect(alert).toContain("color: var(--color-error);");
    const link = rule(".link");
    expect(link).toContain("color: var(--accent);");
    expect(link).toContain("text-decoration: underline;");
    expect(link).toContain("border: 0;");
  });
});

describe("DeniedState and NotFoundState (A3)", () => {
  it("403: the heading and the way back to one's own space, no further text and no alert", () => {
    const html = renderToStaticMarkup(createElement(DeniedState, { title: t.access.deniedTitle, backLabel: t.access.backToOwn, backHref: "/aplikacija/student" }));
    expect(html).toContain(`<h1>${t.access.deniedTitle}</h1>`);
    expect(html).toContain(`<a href="/aplikacija/student">${t.access.backToOwn}</a>`);
    expect(html).not.toContain("role=\"alert\"");
    expect(html.replace(/<[^>]+>/g, "")).toBe(`${t.access.deniedTitle}${t.access.backToOwn}`);
  });

  it("404: \"Stranica ne postoji\", with the way back when given", () => {
    expect(t.errorPage.notFoundTitle).toBe("Stranica ne postoji");
    const bare = renderToStaticMarkup(createElement(NotFoundState, { title: t.errorPage.notFoundTitle }));
    expect(bare.replace(/<[^>]+>/g, "")).toBe("Stranica ne postoji");
    const back = renderToStaticMarkup(createElement(NotFoundState, { title: t.errorPage.notFoundTitle, back: { label: t.access.backToOwn, href: "/aplikacija" } }));
    expect(back).toContain(`<a href="/aplikacija">${t.access.backToOwn}</a>`);
    expect(back).not.toContain("role=\"alert\"");
  });
});
