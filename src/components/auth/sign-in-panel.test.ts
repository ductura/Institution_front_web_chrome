import { readFileSync } from "node:fs";

import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import SignInPanel, { SIGN_IN_HEADING_ID, type SignInPanelProps, type SignInState } from "./SignInPanel";

// Invented sign-in address; the card must pass it through byte for byte.
const HREF = "/prijava/aai?returnTo=%2Frad%3Fzadatak%3Dizmisljeni-1&x=%C5%A1";
const STATES: SignInState[] = ["default", "redirecting", "failed", "unavailable"];

const render = (props: Partial<SignInPanelProps> & { state: SignInState }) =>
  renderToStaticMarkup(createElement(SignInPanel, { href: HREF, ...props }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const count = (html: string, re: RegExp) => (html.match(new RegExp(re, "g")) ?? []).length;
// Source without its comments, which may name what the code must not do.
const code = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

/** The <a> of the card, found in the element tree the pure component returns. */
function link(props: SignInPanelProps): ReactElement<{ href: string; onClick: (e: { preventDefault: () => void }) => void }> {
  const walk = (node: ReactNode): ReactElement | null => {
    if (!node || typeof node !== "object" || !("props" in node)) return null;
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.type === "a") return el;
    const kids = ([] as ReactNode[]).concat(el.props.children ?? []);
    for (const kid of kids) {
      const hit = walk(kid);
      if (hit) return hit;
    }
    return null;
  };
  const found = walk(SignInPanel(props));
  if (!found) throw new Error("no link");
  return found as ReturnType<typeof link>;
}

describe("sign-in card (DAN-1081)", () => {
  for (const state of STATES) {
    it(`${state}: one h1, one link with the href unchanged, no field or password, no forbidden term`, () => {
      const html = render({ state, redirectingText: "Izmišljena najava" });
      expect(count(html, /<h1/)).toBe(1);
      expect(count(html, /<a /)).toBe(1);
      expect(html).toContain(`href="${HREF.replace(/&/g, "&amp;")}"`);
      expect(html).toContain(t.signIn.button);
      // D-09: AAI@EduHr is the only way in.
      expect(html).not.toMatch(/<input|<form|<select|<textarea|<button|type="password"/);
      expect(findForbiddenTerms(text(html))).toEqual([]);
      expect(html).toContain(`id="${SIGN_IN_HEADING_ID}"`);
      expect(count(html, /role="status"/)).toBe(1);
    });
  }

  it("default: product name, explanation, the one action and the password note", () => {
    const html = render({ state: "default" });
    expect(html).toContain(t.app.name);
    expect(html).toContain(t.signIn.cardTitle);
    expect(html).toContain(t.signIn.cardBody);
    expect(html).toContain(t.signIn.passwordNote);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("aria-disabled");
  });

  it("redirecting: the link is busy and not followed again, the text is announced politely", () => {
    const html = render({ state: "redirecting", redirectingText: "Izmišljena najava" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toMatch(/<p role="status"[^>]*>Izmišljena najava<\/p>/);
    expect(html).not.toContain('role="alert"');

    const onActivate = vi.fn();
    const preventDefault = vi.fn();
    link({ state: "redirecting", href: HREF, onActivate }).props.onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("redirecting without a text keeps an empty live region and invents no text", () => {
    const html = render({ state: "redirecting" });
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
  });

  it("failed: a neutral alert, the same link for a new attempt", () => {
    const html = render({ state: "failed" });
    expect(html).toContain(t.auth.failedTitle);
    expect(html).toMatch(new RegExp(`role="alert"[^>]*>${t.auth.failedBody.replace(/[.;?]/g, "\\$&")}`));
    expect(count(html, /role="alert"/)).toBe(1);
  });

  it("unavailable: try later, the same link", () => {
    const html = render({ state: "unavailable" });
    expect(html).toContain(t.auth.unavailableBody);
    expect(count(html, /role="alert"/)).toBe(1);
    expect(html).not.toContain(t.signIn.cardBody);
  });

  it("a click outside redirecting leaves navigation to the browser", () => {
    for (const state of ["default", "failed", "unavailable"] as const) {
      const onActivate = vi.fn();
      const preventDefault = vi.fn();
      const a = link({ state, href: HREF, onActivate });
      expect(a.props.href).toBe(HREF);
      a.props.onClick({ preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(onActivate).toHaveBeenCalledOnce();
    }
  });

  it("rendering alone never activates or navigates", () => {
    const onActivate = vi.fn();
    for (const state of STATES) render({ state, onActivate });
    expect(onActivate).not.toHaveBeenCalled();
    const source = code("./SignInPanel.tsx");
    expect(source).not.toMatch(/\blocation\b|useEffect|setTimeout|document\.|window\.|localStorage|sessionStorage|cookie/);
  });

  it("the default heading id is the one that keeps the page dark, and the catalogue can replace it", () => {
    const css = readFileSync(new URL("../../../packages/ui/src/tokens/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`#${SIGN_IN_HEADING_ID}`);
    expect(render({ state: "default", headingId: "prijava-kartica-9" })).toContain('aria-labelledby="prijava-kartica-9"');
  });

  it("the failure styles use no error colour", () => {
    const css = code("./SignInPanel.module.css");
    expect(css).not.toMatch(/--error|--danger|#[0-9a-f]{3,8}\b|rgb\(|red\b/i);
    expect(css).toMatch(/min-height: (4[4-9]|[5-9]\d)px/);
  });
});
