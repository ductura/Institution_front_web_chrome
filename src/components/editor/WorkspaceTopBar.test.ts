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

  it("leads the mark to Moji zadaci under the base the app is served under (EDI-R02)", () => {
    const under = (base?: string) =>
      renderToStaticMarkup(createElement(WorkspaceTopBarView, { assignmentId: ID, base, title: "Izmišljeni rad", online: true, theme: "dark", onTheme: () => {} }));
    expect(under("/aplikacija")).toContain('href="/aplikacija/zadaci"');
    expect(under("/aplikacija")).toContain('href="/aplikacija/zadaci"');
    expect(under("/aplikacija")).not.toContain('href="/zadaci"');
    expect(under()).toContain('href="/zadaci"');
  });

  it("disables Predaja rada without a network and says why", () => {
    const html = bar(false);
    expect(html).not.toContain("/predaja");
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-describedby="radni-prostor-bez-mreze"/);
    expect(html).toContain(`id="radni-prostor-bez-mreze"`);
    expect(html).toContain(t.workspace.submitOffline);
  });

  it("has one sheet switch that names the other sheet and is pressed while the sheet is white", () => {
    // Prototype `.ed-top`: "Bijeli list" on the dark sheet, "Tamni list" on the white one.
    const light = bar(true, "light");
    expect(light).toMatch(new RegExp(`aria-pressed="true"[^>]*>${t.workspace.sheetThemeDark}<`));
    const dark = bar(true, "dark");
    expect(dark).toMatch(new RegExp(`aria-pressed="false"[^>]*>${t.workspace.sheetThemeLight}<`));
    expect(dark.match(/aria-pressed/g)).toHaveLength(1);
  });

  it("shows the course line and hides Predaja rada on a read only work", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceTopBarView, {
        assignmentId: ID, title: "Izmišljeni rad", subtitle: "Izmišljeni kolegij · rok 8. 11. 2026., 23:59",
        readOnly: true, online: true, theme: "dark", onTheme: () => {},
      }),
    );
    expect(html).toContain("Izmišljeni kolegij · rok 8. 11. 2026., 23:59");
    expect(html).not.toContain(t.workspace.submitWork);
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
