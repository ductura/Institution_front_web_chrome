import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

import EditorPage from "./EditorPage";
import { WorkspaceTopBarView } from "./WorkspaceTopBar";

// WEB-23 (S: E-7): the top bar of the workspace. Invented assignment.
const ID = "00000000-0000-4000-8000-000000000023";
const bar = (online: boolean, theme: "light" | "dark" = "light") =>
  renderToStaticMarkup(
    createElement(WorkspaceTopBarView, { assignmentId: ID, title: "Izmišljeni rad", online, theme, onTheme: () => {} }),
  );

describe("WorkspaceTopBarView", () => {
  it("links back to the assignments and on to the submission screen", () => {
    const html = bar(true);
    expect(html).toContain('href="/zadaci"');
    expect(html).toContain(t.workspace.backToAssignments);
    expect(html).toContain("Izmišljeni rad");
    expect(html).toContain(`href="/rad/${ID}/predaja"`);
    expect(html).toContain(t.workspace.submitWork);
    expect(html).not.toContain(t.workspace.submitOffline);
  });

  it("disables Predaja rada without a network and says why", () => {
    const html = bar(false);
    expect(html).not.toContain("/predaja");
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-describedby="radni-prostor-bez-mreze"/);
    expect(html).toContain(`id="radni-prostor-bez-mreze"`);
    expect(html).toContain(t.workspace.submitOffline);
  });

  it("announces the pressed sheet theme", () => {
    for (const theme of ["light", "dark"] as const) {
      const html = bar(true, theme);
      const pressed = theme === "light" ? t.workspace.sheetThemeLight : t.workspace.sheetThemeDark;
      expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${pressed}<`));
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });
});

describe("EditorPage with a top bar", () => {
  it("puts the top bar in place of the course line and themes the sheet", () => {
    const html = renderToStaticMarkup(
      createElement(EditorPage, {
        course: "Izmišljeni seminar",
        title: "Izmišljeni rad",
        status: createElement("footer", null, "traka"),
        topBar: createElement("header", null, "gornja traka"),
        children: createElement("p", null, "list"),
      }),
    );
    expect(html).toContain("gornja traka");
    expect(html).not.toContain("Izmišljeni seminar / Izmišljeni rad");
    expect(html).toMatch(/<article class="sheet [^"]*" data-sheet-theme="light"/);
  });
});
