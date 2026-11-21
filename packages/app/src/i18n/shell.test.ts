import { describe, expect, it } from "vitest";

import { PAGES, resolve } from "../routes";
import { cataloguesFor } from "./catalogue";
import { navLabel } from "./shell";

const page = (path: string) => PAGES.find((p) => p.path === path)!;

describe("page labels in the interface language", () => {
  it("take the navigation's label in English", () => {
    expect(navLabel(page("/zadaci/kolegiji"), "student", cataloguesFor("en"))).toBe(cataloguesFor("en").t.shell.nav.courses);
    expect(navLabel(page("/zadaci/kolegiji"), "student", cataloguesFor("hr"))).toBe(page("/zadaci/kolegiji").label);
  });

  it("give every page its Croatian label from routes.ts in Croatian", () => {
    const hr = cataloguesFor("hr");
    for (const p of PAGES) {
      const role = p.roles[0] ?? "student";
      expect(navLabel(p, role, hr), p.path).toBe(p.label);
    }
  });

  it("translate every page outside the navigation too", () => {
    const hr = cataloguesFor("hr");
    const en = cataloguesFor("en");
    for (const p of PAGES) {
      const role = p.roles[0] ?? "student";
      expect(navLabel(p, role, en), p.path).not.toBe(navLabel(p, role, hr));
    }
  });
});

describe("/profil", () => {
  it("opens for every signed-in role", () => {
    for (const role of ["student", "teacher", "admin"] as const) expect(resolve("/profil", role)).toMatchObject({ kind: "page" });
  });
});
