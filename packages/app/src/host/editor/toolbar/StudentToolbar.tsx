"use client";

// PIL-K-TRAKA (WEB-1601/2131): the student's editor draws EditorToolbarHost in the tools slot, in place of
// the copied EditorToolbar. Every tool runs the very command the copied toolbar ran (TOOLS, BLOCK_STYLES of
// EditorToolbarFor, same checks at the click), so a change reaches the journal as before. What the new bar has
// no button for (Umetni, Pretvori, Posebni znak, Prikaz, Izvezi and their dialogs) stays here as menus over
// the same helpers and the same words; nothing is new in look or in text.
// ED-30 (P2-1a): the bar now has its behaviour: "Više", folding by width and the tool tips (ToolbarBehaviour.tsx).
// ED-31 (P2-1b): the context button knows where the cursor is, Prikaz has the text size on the screen, and a
// phone gets "Brzi alati" above the keyboard. Only actions this editor has are offered; the rest stay hidden.
import "./text-size.css";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, ContextMenu, Dialog, type MenuEntry, type MenuPoint, type ShellTheme } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import { BLOCK_STYLES, blockStyleOf, stateOf, TOOLS, type ToolbarState as EditorState } from "@/components/editor/EditorToolbarFor";
import { useLocalEditor } from "@/components/editor/LocalDocument";
import { useOpenFind } from "@/components/editor/commands/open-find";
import { editorCommandsHr } from "@/components/editor/commands/messages.hr";
import { crossReferenceMessages } from "@/components/editor/crossref/messages.hr";
import { useV3EditorDialogs, type FootnoteDialogComponent } from "@/components/editor/footnotes/useV3EditorDialogs";
import { EditorCitationSettings } from "@/components/editor/parts/EditorCitationSettings";
import { EditorWorkParts } from "@/components/editor/parts/EditorWorkParts";
import { workPartsMessages } from "@/components/editor/parts/messages.hr";
import { setSheetTheme, useSheetTheme } from "@/components/shell/useSheetTheme";
import {
  convertBlock, glyphOf, insertChar, insertHole, pushRecent, readRecent, SPECIAL_CHARS, writeRecent,
} from "@/components/editor/toolbar-menu";
import { askPrintPreview } from "@/components/editor/print-export/print-event";
import { insertSourceAction } from "../sources-mention/new-source-request";
import { textWithFootnotes } from "@/lib/document/text-with-footnotes";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { useStudentToast } from "../../student/toast/StudentToasts";
import { formulaToolsOf, useFormulaHost } from "../formula/FormulaHost";
import { formulaHostHr } from "../formula/messages.hr";
import { useCodeBlockHost } from "../code-block/CodeBlockHost";
import { codeBlockHr } from "../code-block/messages.hr";
import { profileById, DEFAULT_PROFILE_ID, type RuleProfile } from "../rules/profiles";
import { SkeletonDialog } from "../areas/skeleton/SkeletonDialog";
import { PageFormatDialog } from "@/components/editor/pages/PageFormatDialog";
import { pagesMessages } from "@/components/editor/pages/messages.hr";
import { pageFormatOf } from "../page-format/page-format-of";
import { useActiveProfile } from "../areas/skeleton/active-profile";
import { useSkeletonAvailability } from "../areas/skeleton/use-skeleton-availability";
import { skeletonMessages } from "../areas/skeleton/messages.hr";
import { assignmentIdFromPath, downloadLatex, latexMenuItem, useLatexStyle } from "../stem/latex-export-menu";
import { stemHr } from "../stem/messages.hr";
import { SpeechControls } from "@/components/editor/addons/SpeechControls";
import { ReadAloudControls } from "../read-aloud/ReadAloudControls";
import { readingSettingsHr } from "../reading-settings/messages.hr";
import { ReadingSettingsDialog } from "../reading-settings/ReadingSettingsDialog";
import { moveChapterInEditor, type TocEditor } from "../../../../../editor-core/src/outline/index.ts";
import { placeFromFlags, type ContextAction, type CursorPlace } from "./context-button";
import { useOfferSlashCommands } from "../slash-commands";
import { EditorToolbarHost } from "./EditorToolbarHost";
import { toolbarBehaviourHr } from "./messages.hr";
import { MOBILE_MORE, type QuickTool } from "./quick-tools";
import { canStep, DEFAULT_ZOOM, loadZoom, saveZoom, snapZoom, stepZoom, zoomPercent, zoomToast } from "./text-size";
import { MobileQuickBar } from "./ToolbarBehaviour";
import type { BlockStyle, ToolbarCommands, ToolbarState } from "./toolbar-model";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type ToolbarPrefs } from "./toolbar-prefs";
import { currentShell, pendingViewItems, readClean, setClean, setShell, shellItems, viewItems } from "./view-menu";
import { DraftPanelHost } from "../draft-panel/DraftPanelHost";
import { requestPanel } from "@/components/editor/layout-prefs/open-panel";
import { readSheetToc, setSheetToc, sheetTocKeyOf, subscribeSheetToc } from "../toc/sheet-toc";
import { requestPregledView } from "../right/pregled-view";

/** The browser's storage, reached lazily: even reaching it can throw. */
const localStore = () => window.localStorage;

/** "Stavi tekst rada u međuspremnik": text with [n] marks and the footnote list (v3). False when refused. */
async function copyWorkText(editor: Editor | null): Promise<boolean> {
  if (!editor || editor.isDestroyed) return false;
  try {
    await globalThis.navigator.clipboard.writeText(textWithFootnotes(editor));
    return true;
  } catch {
    return false;
  }
}

/** What the toast says after "Stavi tekst rada u međuspremnik" (prototype ACT.copy). */
export const copyToastText = (ok: boolean): string => ok ? toolbarBehaviourHr.copyDone : toolbarBehaviourHr.copyFailed;

/** The "Izvezi" menu: the print preview, then the copy (prototype toolbar2: Pregled ispisa before Kopiraj). */
export function exportMenuItems(editor: Editor | null): { id: string; label: string; disabled?: boolean }[] {
  return [
    { id: "print", label: t.toolbar.exportItems.print },
    { id: "copy", label: t.toolbar.exportItems.copy, disabled: !editor || editor.isDestroyed },
  ];
}

const live = (editor: Editor | null): editor is Editor => !!editor && !editor.isDestroyed && editor.isEditable;

/** ED-R18: a dictated phrase typed at the caret (over the selection) with a space after it; false when the editor is not writable. */
export function insertDictatedPhrase(editor: Editor | null, phrase: string): boolean {
  const text = phrase.trim();
  if (!text || !live(editor)) return false;
  editor.chain().focus().command(({ tr }) => { tr.insertText(`${text} `); return true; }).run();
  return true;
}

/** The editor's state as the toolbar model wants it. The V2 schema has no numbered list, so it is never on. */
export function toolbarStateOf(s: EditorState): ToolbarState {
  return {
    canUndo: s.canUndo, canRedo: s.canRedo, block: blockStyleOf(s), bold: s.bold, italic: s.italic,
    bulletList: s.bulletItem, numberedList: false, quote: s.quote, editable: s.editable,
  };
}

/** The names the copied toolbar gave its tools, kept (the @ductura/ui bar names the headings and the quote differently). */
/** The copied toolbar's accessible name, kept for the bar (WEB-15 finds the bar by it). */
export const KEPT_TOOLBAR_LABEL = t.toolbar.label;

export const KEPT_LABELS = {
  heading1: t.toolbar.heading1, heading2: t.toolbar.heading2, heading3: t.toolbar.heading3, quote: t.toolbar.quote,
} as const;

/** The toolbar's commands over one editor: the copied toolbar's own, checked again at the click. */
export function toolbarCommands(editor: Editor | null): ToolbarCommands {
  const tool = (key: string) => () => {
    const found = TOOLS.find((candidate) => candidate.key === key);
    if (!found || !live(editor) || !(found.enabled?.(stateOf(editor)) ?? true)) return;
    found.run(editor);
  };
  return {
    undo: tool("undo"), redo: tool("redo"), toggleBold: tool("bold"), toggleItalic: tool("italic"),
    toggleBulletList: tool("bulletItem"), toggleQuote: tool("quote"), toggleNumberedList: () => undefined,
    setBlock: (style: BlockStyle) => { if (live(editor)) BLOCK_STYLES.find((b) => b.key === style)?.run(editor); },
  };
}

/**
 * ED-31: where the cursor is, for the context button. The block styles are the design's levels: heading 1 the
 * work's title (no button), 2 the chapter, 3 the subchapter. List and quote are flat paragraphs here (E1).
 */
export function cursorPlaceOf(s: EditorState): CursorPlace {
  const headingLevel = s.heading1 ? 1 : s.heading2 ? 2 : s.heading3 ? 3 : undefined;
  return placeFromFlags({ headingLevel, quote: s.quote, list: s.bulletItem });
}

/** Context actions this editor cannot run yet (no citation picker in the bar; cross-references only with v3). */
export function hiddenContextActions(canCrossReference: boolean): ContextAction[] {
  return ["quote.cite", ...(canCrossReference ? [] : ["heading.xref" as const])];
}

/** Runs a context action over the editor; the cross-reference dialog comes from the shell. */
export function runContextAction(editor: Editor | null, id: ContextAction, openCrossReference?: () => void): void {
  if (!live(editor)) return;
  const commands = toolbarCommands(editor);
  if (id === "heading.level2") commands.setBlock("heading2");
  else if (id === "heading.level3") commands.setBlock("heading3");
  else if (id === "heading.up" || id === "heading.down") moveChapterInEditor(editor, id === "heading.up" ? "up" : "down");
  else if (id === "heading.xref") openCrossReference?.();
  else if (id === "quote.back") convertBlock(editor, "paragraph");
  else if (id === "list.leave") commands.toggleBulletList();
}

/** Quick tools with no action in this editor yet: Navod needs the citation picker, Komentar the comment action. */
export const HIDDEN_QUICK_TOOLS: readonly QuickTool["id"][] = ["cite", "comment"];

/** The phone's "Više" as far as this editor has the actions (MOBILE_MORE without its three submenus and the palette). */
export function quickMoreItems(s: EditorState): { id: string; label: string; disabled?: boolean }[] {
  return MOBILE_MORE.filter((m) => m.id === "redo" || m.id === "bold" || m.id === "italic")
    .map((m) => ({ id: m.id, label: m.id === "bold" && s.bold || m.id === "italic" && s.italic ? `✓ ${m.label}` : m.label, disabled: m.id === "redo" && !s.canRedo }));
}

/** Manji / Veći tekst in Prikaz: off at the ends of the five steps; Veći shows the size now. */
export function textSizeItems(zoom: number): { id: "textSmaller" | "textLarger"; label: string; disabled: boolean }[] {
  return [
    { id: "textSmaller", label: toolbarBehaviourHr.textSmaller, disabled: !canStep(zoom, -1) },
    { id: "textLarger", label: `${toolbarBehaviourHr.textLarger} (${zoomPercent(zoom)} %)`, disabled: !canStep(zoom, 1) },
  ];
}

/** Puts the size on <html>: the sheet's type is multiplied by --tz (reading-font.css); 100 % leaves no trace. */
export function applyZoom(zoom: number, root: HTMLElement = document.documentElement): void {
  const z = snapZoom(zoom);
  if (z === DEFAULT_ZOOM) { root.removeAttribute("data-text-size"); root.style.removeProperty("--tz"); return; }
  root.setAttribute("data-text-size", String(zoomPercent(z)));
  root.style.setProperty("--tz", String(z));
}

/** Whether the editor has the focus, read again on its focus and blur (the quick bar shows only then). */
function useEditorFocused(editor: Editor | null): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    setFocused(editor.isFocused);
    editor.on("focus", on);
    editor.on("blur", off);
    return () => { editor.off("focus", on); editor.off("blur", off); };
  }, [editor]);
  return focused;
}

type Item = { id: string; label: string; disabled?: boolean; /** The reason an item is off, shown beside it. */ hint?: string };

/** ED-44 (P2-16): the prototype's "Umetni" items the host cannot insert yet; shown, never hidden (Val 6). */
export const PENDING_INSERTS = ["table", "image", "phrase", "variant"] as const;
/** The prototype's order of "Umetni"; the host's own items not in the prototype follow. */
const INSERT_ORDER = ["cite", "newSource", "table", "image", "footnote", "xref", "formula", "inlineFormula", "codeBlock", "hole", "phrase", "variant"];

/** The host's insert items with the prototype's pending ones put in their place, disabled and marked "nedostupno". */
export function withPendingInserts(items: readonly Item[]): Item[] {
  const pending = PENDING_INSERTS.map((id): Item => ({
    id, label: t.toolbar.insertItems[id], disabled: true, hint: toolbarBehaviourHr.menuUnavailable,
  }));
  const all = [...items, ...pending.filter((p) => !items.some((i) => i.id === p.id))];
  const rank = (id: string) => { const at = INSERT_ORDER.indexOf(id); return at < 0 ? INSERT_ORDER.length : at; };
  return all.map((item, at) => ({ item, at })).sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.at - b.at).map((x) => x.item);
}

function Menu({ label, items, onSelect }: { label: string; items: readonly Item[]; onSelect: (id: string) => void }) {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const entries: MenuEntry[] = items.map((i) => ({ kind: "item", id: i.id, label: i.label, disabled: i.disabled, hint: i.hint }));
  return (
    <>
      <Button tone="quiet" aria-haspopup="menu"
        onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setAnchor({ x: b.left, y: b.bottom }); }}>{label} ▾</Button>
      <ContextMenu anchor={anchor} entries={entries} label={label} onClose={() => setAnchor(null)}
        onSelect={(id) => { setAnchor(null); onSelect(id); }} />
    </>
  );
}

/** The editor's state, read again on every transaction and kept when nothing changed (the host has no @tiptap/react). */
function useEditorSnapshot(editor: Editor | null): EditorState {
  const [state, setState] = useState<EditorState>(() => stateOf(editor));
  useEffect(() => {
    const read = () => setState((was) => { const next = stateOf(editor); return JSON.stringify(was) === JSON.stringify(next) ? was : next; });
    read();
    if (!editor || editor.isDestroyed) return;
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  return state;
}

/** The student's toolbar, bound to the local document. */
export function StudentToolbar({ workPartsKey, footnoteDialog, confirmedWorkSchemaVersion, skeletonProfile }: {
  workPartsKey: string; footnoteDialog?: FootnoteDialogComponent; confirmedWorkSchemaVersion?: number;
  /** Profile whose sections the "Kostur rada" dialog offers; the general academic work when absent. */
  skeletonProfile?: RuleProfile | null;
}) {
  const editor = useLocalEditor();
  const state = useEditorSnapshot(editor);
  const theme = useSheetTheme();
  const v3 = useV3EditorDialogs(editor, confirmedWorkSchemaVersion, footnoteDialog);
  // The profile the student chose in "Zahtjevi rada" (WEB-DIZ-B-V21); a profile given by the caller wins.
  const chosenProfile = useActiveProfile();
  const workProfile = skeletonProfile ?? chosenProfile;
  const formula = useFormulaHost(editor, confirmedWorkSchemaVersion, formulaToolsOf(workProfile));
  const code = useCodeBlockHost(editor, confirmedWorkSchemaVersion);
  const skeletonState = useSkeletonAvailability(editor, workProfile ?? profileById(DEFAULT_PROFILE_ID) ?? null);
  const latexStyle = useLatexStyle(typeof window === "undefined" ? null : assignmentIdFromPath(window.location.pathname));
  const [dialog, setDialog] = useState<"parts" | "citation" | "reading" | "skeleton" | "structure" | "pageFormat" | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const writeOk = live(editor) && state.editable;
  const toast = useStudentToast();
  const openFind = useOpenFind();
  // ED-30: the bar's tool choice and look, kept in this browser (toolbar-prefs).
  // Read after mount, so the server's markup and the first client render agree.
  const [prefs, setPrefs] = useState<ToolbarPrefs>(DEFAULT_PREFS);
  useEffect(() => { setPrefs(loadPrefs()); }, []);
  const onPrefs = (next: ToolbarPrefs) => { setPrefs(next); savePrefs(next); };
  // ED-31: the text size on the screen, kept in this browser (text-size); read after mount like the prefs.
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  useEffect(() => { const z = loadZoom(); setZoom(z); applyZoom(z); }, []);
  const onZoom = (direction: -1 | 1) => {
    const next = stepZoom(zoom, direction);
    if (next === zoom) return;
    setZoom(next); saveZoom(next); applyZoom(next); toast(zoomToast(next));
  };
  // ED-44: the app's own light or dark ("Ljuska"); read after mount, as the inline theme script set it.
  const [shell, setShellTheme] = useState<ShellTheme>("dark");
  useEffect(() => { setShellTheme(currentShell(document.documentElement, localStore)); }, []);
  // "Čisti tekst": read after mount, as the shell theme is.
  const [clean, setCleanText] = useState(false);
  useEffect(() => { const on = readClean(document.documentElement, localStore); setCleanText(on); setClean(document.documentElement, localStore, on); }, []);
  // ED-71: "Sadržaj na listu", kept for this person and work (sheet-toc); off on the server's markup.
  const tocKey = sheetTocKeyOf(workPartsKey);
  const sheetToc = useSyncExternalStore(subscribeSheetToc, () => readSheetToc(tocKey), () => false);
  const focused = useEditorFocused(editor);
  const [quickMore, setQuickMore] = useState<MenuPoint | null>(null);
  const openCrossReference = v3.openInsert ? () => v3.openInsert?.("crossReference") : undefined;
  // ED-46 (P2-18): "/fusnota" and "/ref" open the same dialogs as Umetni, and only when Umetni would.
  useOfferSlashCommands(editor, writeOk && v3.openInsert
    ? { fusnota: () => v3.openInsert?.("footnote"), ref: () => v3.openInsert?.("crossReference") } : {});

  const insert: Item[] = withPendingInserts([
    // ED-92: Navod opens the source list at the caret (as "@"), Novi izvor the quick source dialog (as "@ › Dodaj").
    { id: "cite", label: t.toolbar.insertItems.cite, disabled: !writeOk },
    { id: "newSource", label: t.toolbar.insertItems.newSource, disabled: !writeOk },
    { id: "footnote", label: t.toolbar.insertItems.footnote, disabled: !writeOk || !v3.openInsert },
    { id: "xref", label: crossReferenceMessages.title, disabled: !writeOk || !v3.openInsert },
    { id: "formula", label: formulaHostHr.insertBlock, disabled: !writeOk || !formula.availability.enabled, hint: formula.availability.enabled ? undefined : formula.availability.reason },
    { id: "inlineFormula", label: formulaHostHr.insertInline, disabled: !writeOk || !formula.availability.enabled, hint: formula.availability.enabled ? undefined : formula.availability.reason },
    { id: "codeBlock", label: code.inBlock ? codeBlockHr.edit : codeBlockHr.insert, disabled: !writeOk || !code.availability.enabled, hint: code.availability.enabled ? undefined : code.availability.reason },
    { id: "hole", label: t.toolbar.insertItems.hole, disabled: !writeOk },
    { id: "workParts", label: workPartsMessages.title, disabled: !writeOk },
    { id: "skeleton", label: skeletonMessages.menu, disabled: !writeOk || !skeletonState.enabled, hint: skeletonState.enabled ? undefined : skeletonState.reason },
  ]);
  const convert: Item[] = [
    { id: "toQuote", label: t.toolbar.convertItems.toQuote, disabled: !writeOk || state.quote },
    { id: "fromQuote", label: t.toolbar.convertItems.fromQuote, disabled: !writeOk || !state.quote },
  ];
  const chars = [...recent, ...SPECIAL_CHARS.filter((ch) => !recent.includes(ch))]
    .map((ch): Item => ({ id: `char:${ch}`, label: `${glyphOf(ch)}  ${t.toolbar.specialChars[ch] ?? ""}`, disabled: !writeOk }));
  const view: Item[] = [
    { id: "dark", label: `${theme === "dark" ? "✓ " : ""}${t.workspace.sheetThemeDark}` },
    { id: "light", label: `${theme === "light" ? "✓ " : ""}${t.workspace.sheetThemeLight}` },
    ...shellItems(shell),
    { id: "citationSettings", label: workPartsMessages.citationTitle },
    { id: "readingSettings", label: readingSettingsHr.menu },
    // F4-PM1-R12A: the page format from the faculty rules, read only, so also on a submitted work.
    { id: "pageFormat", label: pagesMessages.formatTitle },
    ...textSizeItems(zoom),
    ...viewItems(clean, sheetToc),
    ...pendingViewItems(),
  ];
  return (
    <>
      <EditorToolbarHost state={toolbarStateOf(state)} commands={toolbarCommands(editor)} label={KEPT_TOOLBAR_LABEL} labels={KEPT_LABELS} omit={["numberedList"]}
        behaviour={{
          prefs, onPrefs, fit: true, intro: state.editable ? "write" : "locked",
          place: cursorPlaceOf(state), hideContext: hiddenContextActions(Boolean(openCrossReference)),
          onContextAction: (id) => runContextAction(editor, id, openCrossReference),
        }} />
      <Menu label={t.toolbar.insert} items={insert} onSelect={(id) => {
        if (id === "cite" || id === "newSource") { if (writeOk) insertSourceAction(editor, id); }
        else if (id === "footnote") v3.openInsert?.("footnote");
        else if (id === "xref") v3.openInsert?.("crossReference");
        else if (id === "workParts" && writeOk) setDialog("parts");
        else if (id === "formula" || id === "inlineFormula") formula.open(id === "formula" ? "block" : "inline");
        else if (id === "codeBlock" && writeOk) code.open(code.inBlock);
        else if (id === "skeleton" && writeOk) setDialog("skeleton");
        else if (id === "hole") insertHole(editor);
      }} />
      <Menu label={t.toolbar.convert} items={convert} onSelect={(id) => {
        if (id === "toQuote" || id === "fromQuote") convertBlock(editor, id === "toQuote" ? "quote" : "paragraph");
      }} />
      <Menu label={t.toolbar.specialChar} items={chars} onSelect={(id) => {
        const ch = id.slice("char:".length);
        if (!insertChar(editor, ch)) return;
        const next = pushRecent(recent, ch);
        setRecent(next);
        writeRecent(next);
      }} />
      {/* ED-34 (P2-9): "Traži" as in the prototype's bar, also on a submitted work; it opens the row Ctrl+F opens. */}
      {openFind && <Button tone="quiet" data-find-open="" aria-keyshortcuts="Control+F Meta+F"
        title={`${editorCommandsHr.findAndReplace} (Ctrl+F)`} onClick={openFind}>{editorCommandsHr.find}</Button>}
      <Menu label={t.toolbar.view} items={view} onSelect={(id) => {
        if (id === "citationSettings") setDialog("citation");
        else if (id === "readingSettings") setDialog("reading");
        else if (id === "pageFormat") setDialog("pageFormat");
        else if (id === "structure") setDialog("structure");
        else if (id === "cleanText") setCleanText(setClean(document.documentElement, localStore, !clean));
        else if (id === "viewToc") setSheetToc(tocKey, !sheetToc);
        else if (id === "viewFirstLines") { requestPanel("review"); requestPregledView("nacrt"); }
        else if (id === "textSmaller" || id === "textLarger") onZoom(id === "textSmaller" ? -1 : 1);
        else if (id === "shell:dark" || id === "shell:light") setShellTheme(setShell(document.documentElement, localStore, id === "shell:light" ? "light" : "dark"));
        else if (id === "dark" || id === "light") setSheetTheme(id);
      }} />
      <Menu label={t.toolbar.export} items={[...exportMenuItems(editor), latexMenuItem(editor, confirmedWorkSchemaVersion, latexStyle)]}
        onSelect={(id) => {
          if (id === "print") askPrintPreview();
          else if (id === "latex") toast(downloadLatex(editor, confirmedWorkSchemaVersion, latexStyle) ? stemHr.latex.done : stemHr.latex.failed);
          else if (id === "copy") void copyWorkText(editor).then((ok) => toast(copyToastText(ok)));
        }} />
      <ReadAloudControls editor={editor} />
      {/* ED-R18: dictation into the document; reading aloud is the menu above, so only "Diktiraj" shows. */}
      <SpeechControls reading={false} editable={writeOk} getText={() => ""} onPhrase={(phrase) => { insertDictatedPhrase(editor, phrase); }} />
      <MobileQuickBar editable={writeOk} focused={focused} dialogOpen={dialog !== null} canUndo={state.canUndo} hide={HIDDEN_QUICK_TOOLS}
        onTool={(id, at) => {
          if (id === "undo") toolbarCommands(editor).undo();
          else if (id === "hole") insertHole(editor);
          else if (id === "more") setQuickMore(at);
        }} />
      <ContextMenu anchor={quickMore} label={toolbarBehaviourHr.mobileMore} onClose={() => setQuickMore(null)}
        entries={quickMoreItems(state).map((i): MenuEntry => ({ kind: "item", ...i }))}
        onSelect={(id) => {
          setQuickMore(null);
          const run = toolbarCommands(editor);
          if (id === "redo") run.redo();
          else if (id === "bold") run.toggleBold();
          else if (id === "italic") run.toggleItalic();
        }} />
      {dialog === "parts" && editor && <EditorWorkParts editor={editor} storageKey={workPartsKey} onClose={() => setDialog(null)} />}
      {dialog === "skeleton" && editor && <SkeletonDialog editor={editor} profile={workProfile ?? profileById(DEFAULT_PROFILE_ID) ?? null} onClose={() => setDialog(null)} />}
      {dialog === "structure" && (
        <Dialog open title={toolbarBehaviourHr.viewStructure} onClose={() => setDialog(null)}
          actions={<Button onClick={() => setDialog(null)}>{toolbarBehaviourHr.viewStructureClose}</Button>}>
          <DraftPanelHost editor={editor as unknown as TocEditor | null} workId={workPartsKey} />
        </Dialog>
      )}
      {dialog === "citation" && <EditorCitationSettings onClose={() => setDialog(null)} />}
      {dialog === "pageFormat" && <PageFormatDialog format={pageFormatOf(workProfile ?? profileById(DEFAULT_PROFILE_ID) ?? null)} onClose={() => setDialog(null)} />}
      {/* Always mounted: it creates the reading store, which puts the saved data-reading-* on <html> after a refresh. */}
      <ReadingSettingsDialog open={dialog === "reading"} onClose={() => setDialog(null)} />
      {v3.dialog}
      {formula.dialog}
      {code.dialog}
    </>
  );
}
