// @vitest-environment jsdom
// WEB-V22-RUTE: the three routes are mounted in app/[base]/ and render their heading from the host's page.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => undefined }), useSearchParams: () => new URLSearchParams("") }));

import { cataloguesFor } from "../i18n/catalogue";
import { navLabel } from "../i18n/shell";
import { PAGES, type Page } from "../routes";
import { HostContext } from "./context";
import IsvuRoute from "./admin/isvu/IsvuRoute";
import IsvuGradesRoute from "./teacher/isvu-grades/IsvuGradesRoute";
import StudomatEntryRoute from "./public/studomat-entry/StudomatEntryRoute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = (path: string): Page => PAGES.find((p) => p.path === path)!;
const appDir = join(__dirname, "../../app/[base]");
let root: Root | null = null;
let el: HTMLElement | null = null;

function show(path: string, role: "admin" | "teacher" | null, child: ReturnType<typeof createElement>): HTMLElement {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(createElement(HostContext, { value: { base: "/app/web", page: page(path), role } }, child)));
  return el;
}
afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = el = null;
});

describe("the ISVU routes are mounted", () => {
  it.each([
    ["/ustanova/isvu", "ustanova/isvu/page.tsx"],
    ["/nastavnik/kolegiji/[courseId]/isvu-ocjene", "nastavnik/kolegiji/[courseId]/isvu-ocjene/page.tsx"],
    ["/ulaz/studomat", "ulaz/studomat/page.tsx"],
  ])("%s has a Next page", (path, file) => {
    expect(page(path)).toBeDefined();
    expect(existsSync(join(appDir, file))).toBe(true);
  });

  it("gives each a title in both interface languages that differ", () => {
    for (const path of ["/ustanova/isvu", "/nastavnik/kolegiji/[courseId]/isvu-ocjene", "/ulaz/studomat"]) {
      const hr = navLabel(page(path), "admin", cataloguesFor("hr"));
      expect(hr, path).toBe(page(path).label);
      expect(navLabel(page(path), "admin", cataloguesFor("en")), path).not.toBe(hr);
    }
  });
});

describe("the thin components", () => {
  it("shows the import's heading", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => new Promise(() => undefined)) as typeof fetch; // the page's reads stay pending: no answer after unmount
    try {
      expect(show("/ustanova/isvu", "admin", createElement(IsvuRoute)).querySelector("h1")?.textContent).toBe("Povezivanje s ISVU-om (probni izvor)");
    } finally {
      globalThis.fetch = real;
    }
  });

  it("shows the grade export's heading for any course id, an unknown one too", () => {
    for (const id of ["11111111-1111-4111-8111-111111111111", "nema-takvog", ""]) {
      const out = show("/nastavnik/kolegiji/[courseId]/isvu-ocjene", "teacher", createElement(IsvuGradesRoute, { courseId: id }));
      expect(out.querySelector("h1")?.textContent).toBe("Izvoz ocjena u ISVU (probni izvor)");
      act(() => root!.unmount());
      el!.remove();
    }
  });

  // WEB-V22-STUDOMAT-ULAZ replaced the body (outside its paths, intentional): the page says only "Preusmjeravanje"; behaviour is in studomat-entry.dom.test.ts.
  it("shows the Studomat entry in its own main", () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => new Promise(() => undefined)) as typeof fetch;
    try {
      const out = show("/ulaz/studomat", null, createElement(StudomatEntryRoute));
      expect(out.querySelector("main#sadrzaj h1")?.textContent).toBe("Preusmjeravanje");
    } finally {
      globalThis.fetch = real;
    }
  });
});
