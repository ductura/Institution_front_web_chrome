import { readdirSync } from "node:fs";
import { basename } from "node:path";

import * as ui from "@ductura/ui";
import { describe, expect, it } from "vitest";

import { CATALOG_STATES, catalogGaps, componentNames } from "./coverage";
import * as screens from "../../src/components/index.ts";
import { ENTRIES, SCREEN_ENTRIES } from "./entries";

// Components present in the migration base before catalogue integration.
// New component files still need a public export and catalogue entry.
const PENDING_SCREEN_ENTRIES = new Set([
  "admin/FacultyRules.tsx",
  "admin/InstitutionCourses.tsx",
  "admin/InstitutionOverview.tsx",
  "admin/TeacherRoles.tsx",
  "auth/AccessCard.tsx",
  "auth/SignInScreen.tsx",
  "editor/CommentPanel.tsx",
  "editor/EarlierDraft.tsx",
  "editor/EditorPage.tsx",
  "editor/EditorPageWork.tsx",
  "editor/EditorToolbar.tsx",
  "editor/EditorToolbarFor.tsx",
  "editor/HeadingOutline.tsx",
  "editor/LocalDocument.tsx",
  "editor/LogoutDialog.tsx",
  "editor/OfflineNotice.tsx",
  "editor/OpenWork.tsx",
  "editor/RevisionPanel.tsx",
  "editor/SidePanels.tsx",
  "editor/SourcesPanel.tsx",
  "editor/StatusBar.tsx",
  "editor/StatusBarLive.tsx",
  "editor/StatusLength.tsx",
  "editor/ToolbarMenu.tsx",
  "editor/WorkspaceTopBar.tsx",
  "editor/citations/CitationPopover.tsx",
  "editor/citations/ReviewPlaces.tsx",
  "editor/commands/EditorCommands.tsx",
  "editor/crossref/CrossReferenceDialog.tsx",
  "editor/footnotes/FootnoteDialog.tsx",
  "editor/footnotes/useV3EditorDialogs.tsx",
  "editor/help/EditorHelp.tsx",
  "editor/help/EditorHelpMenu.tsx",
  "editor/help/EditorNotices.tsx",
  "editor/layout-prefs/EditorPanelLayout.fixture.tsx",
  "editor/layout-prefs/EditorPanelLayout.tsx",
  "editor/layout-prefs/LeftPanel.tsx",
  "editor/layout-prefs/PanelSettings.tsx",
  "editor/layout-prefs/RightPanel.tsx",
  "editor/layout/EditorShell.tsx",
  "editor/parts/CitationSettingsDialog.tsx",
  "editor/parts/EditorCitationSettings.tsx",
  "editor/parts/EditorWorkParts.tsx",
  "editor/parts/WorkPartsDialog.tsx",
  "editor/print-export/PrintExportDialog.tsx", // WEB-10E: awaits the export client and toolbar integration.
  "editor/sources/panel/SourceList.tsx",
  "editor/sources/quick-source/QuickSource.tsx",
  "editor/triggers/TriggerPopover.tsx",
  "editor/triggers/browser/fixture.tsx",
  "how-it-works/HowItWorks.tsx",
  "replay/ReplayView.tsx",
  "shell/AppHeader.tsx",
  "shell/NoRoleCard.tsx",
  "shell/RoleShell.tsx",
  "shell/SessionObserver.tsx",
  "shell/SheetFrame.tsx",
  "shell/ShellLogout.tsx",
  "shell/ShellRail.tsx",
  "shell/ShellSignOut.tsx",
  "shell/ThemeRestore.tsx",
  "shell/WorkspaceShell.tsx",
  "status/StatusBoard.tsx",
  "student/AccessLogView.tsx",
  "student/AssignmentNotice.tsx",
  "student/EnrollForm.tsx",
  "student/NoticeCourse.tsx",
  "student/StudentWorkspace.tsx",
  "student/Submission.tsx",
  "student/TeacherViewSheet.tsx",
  "student/WorkDocumentProvider.tsx",
  "student/radovi/MyWorks.tsx",
  "student/upis/EnrollForm.tsx",
  "summary/ProcessSummaryView.tsx",
  "support/ProblemReport.tsx",
  "teacher/AssignmentVersionForm.tsx",
  "teacher/FastPath.tsx",
  "teacher/LiveText.tsx",
  "teacher/LiveWorkView.tsx",
  "teacher/RecordLimits.tsx",
  "teacher/SummaryCard.tsx",
  "teacher/TeacherComments.tsx",
  "teacher/TeacherSetup.tsx",
  "teacher/WorkLanguageCard.tsx",
  "teacher/WorkLanguageExceptionCard.tsx",
  "teacher/kolegiji/CourseCodes.tsx",
  "teacher/shell/TeacherShell.tsx",
  "teacher/shell/TeacherShellFrame.tsx",
]);

describe("every component has a catalogue entry with all five states (web.md §6 B5)", () => {
  it("the catalogue covers every component @ductura/ui exports", () => {
    expect(catalogGaps(ui, ENTRIES)).toEqual([]);
  });

  it("the catalogue covers every component src/components exports (DAN-753)", () => {
    expect(catalogGaps(screens, SCREEN_ENTRIES)).toEqual([]);
  });

  it("src/components exports component files outside the migration backlog (DAN-753)", () => {
    const root = new URL("../../src/components/", import.meta.url);
    const exports = componentNames(screens);
    const coveredFiles = readdirSync(root, { recursive: true, encoding: "utf8" })
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => file.endsWith(".tsx") && !/\.(?:test|spec)\.tsx$/.test(file) && !file.startsWith("node_modules/"))
      .filter((file) => !PENDING_SCREEN_ENTRIES.has(file) || exports.includes(basename(file, ".tsx")))
      .map((file) => basename(file, ".tsx"))
      .sort();
    expect(coveredFiles).toEqual(exports);
  });

  it("the five states are the plan's, in its order", () => {
    expect(CATALOG_STATES).toEqual(["prazno", "učitavanje", "greška", "puno", "onemogućeno"]);
  });

  const all = Object.fromEntries(CATALOG_STATES.map((s) => [s, () => null]));

  it("fails for a new component without an entry", () => {
    const exports = { ...ui, ExampleComponent: () => null };
    expect(catalogGaps(exports, ENTRIES)).toEqual(["ExampleComponent: nema unosa u katalogu"]);
  });

  it("fails for an entry missing a state, and for an extra state", () => {
    const { greška: _drop, ...four } = all;
    expect(catalogGaps({ Button: ui.Button }, { Button: four })).toEqual(["Button: nedostaje stanje greška"]);
    expect(catalogGaps({ Button: ui.Button }, { Button: { ...all, hover: () => null } }))
      .toEqual(["Button: nepoznato stanje hover"]);
  });

  it("fails for an entry of a component that does not exist", () => {
    expect(catalogGaps({}, { Ghost: all })).toEqual(["Ghost: unos bez komponente"]);
  });

  it("counts only capitalised functions as components", () => {
    expect(componentNames({ Button: () => null, saveStateContent: () => null, SAVE_STATES: {}, THEME_KEY: "x" }))
      .toEqual(["Button"]);
  });
});
