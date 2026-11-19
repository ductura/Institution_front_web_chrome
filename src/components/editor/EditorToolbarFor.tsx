"use client";

/**
 * The toolbar above the sheet (WEB-15, E§3.6 toolbar2; F-8 step 1).
 *
 * Only what the V2 schema holds: undo and redo, the block style (paragraph,
 * title of the work, chapter, subchapter), bold and italic, bullet item and
 * quote, in the prototype's order, groups set apart by a rule. Buttons show
 * the icons of @ductura/ui and carry their name in aria-label and title; the
 * block style is a menu that names the current style, as the prototype's
 * select does. Every control runs an editor command, so a change reaches the
 * journal exactly as typing does; the toolbar itself stores nothing.
 *
 * One Tab stop (WAI-ARIA toolbar): arrows, Home and End move between buttons.
 * While the editor may not be written in (loading, another tab, a failure,
 * signing out) every control says so with `aria-disabled` and does nothing,
 * and stays reachable, so a keyboard user learns why nothing happens.
 *
 * FE-D5 ("Više ▾", "Prikaz ▾"): when the toolbar is too narrow, "Ponovi",
 * the quote and the list move into "Više" (prototype priorities), where each
 * item runs the very same command with the very same check as its button;
 * "Prikaz" holds the sheet theme.
 *
 * This module never imports the local document (journal, sync, sign-out), so
 * the public sandbox (DAN-354) can load it alone; `EditorToolbar.tsx` binds it
 * to the writing page's document.
 */

import { Icon, type IconName } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent,
} from "react";

import { setSheetTheme, useSheetTheme } from "@/components/shell/useSheetTheme";
import { messagesHr as t } from "@/lib/i18n/messages.hr";
import type { SheetTheme } from "@/lib/ui/sheet-theme";

import styles from "./EditorToolbar.module.css";
import ToolbarMenu from "./ToolbarMenu";
import { MAX_COLLAPSED, rovingIndex, splitTools } from "./toolbar-menu";

export type ToolbarState = {
  editable: boolean;
  paragraph: boolean;
  bulletItem: boolean;
  quote: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bold: boolean;
  italic: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

export const IDLE: ToolbarState = {
  editable: false, paragraph: false, bulletItem: false, quote: false, heading1: false, heading2: false, heading3: false,
  bold: false, italic: false, canUndo: false, canRedo: false,
};

export function stateOf(editor: Editor | null): ToolbarState {
  if (!editor || editor.isDestroyed) return IDLE;
  const editable = editor.isEditable;
  return {
    editable,
    paragraph: editor.isActive("paragraph"),
    bulletItem: editor.isActive("bulletItem"),
    quote: editor.isActive("quote"),
    heading1: editor.isActive("heading", { level: 1 }),
    heading2: editor.isActive("heading", { level: 2 }),
    heading3: editor.isActive("heading", { level: 3 }),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    canUndo: editable && editor.can().undo(),
    canRedo: editable && editor.can().redo(),
  };
}

export type BlockStyle = "paragraph" | "heading1" | "heading2" | "heading3";

/** The prototype's `#blockStyle` options, in its order. */
export const BLOCK_STYLES: readonly { key: BlockStyle; label: string; run: (editor: Editor) => void }[] = [
  { key: "paragraph", label: t.toolbar.paragraph, run: (e) => e.chain().focus().setParagraph().run() },
  ...([1, 2, 3] as const).map((level) => ({
    key: `heading${level}` as const,
    label: t.toolbar[`heading${level}`],
    run: (e: Editor) => e.chain().focus().setHeading({ level }).run(),
  })),
];

/**
 * The one block style the whole selection has, or null: inside a list item
 * or a quote, or across blocks of different styles, no style is claimed.
 */
export function blockStyleOf(state: ToolbarState): BlockStyle | null {
  const on = BLOCK_STYLES.filter(({ key }) => state[key]);
  return on.length === 1 ? on[0]!.key : null;
}

export type Tool = {
  key: string;
  label: string;
  /** Tools of one group sit together; a rule separates the groups (prototype `.sep`). */
  group: "history" | "block";
  /** The block style is a menu, not a button; it has no icon of its own. */
  icon?: IconName;
  /** Shown in the title and aria-keyshortcuts, e.g. "Ctrl+Z". */
  keys?: string;
  /** Toggle buttons only: whether it is on. */
  pressed?: (state: ToolbarState) => boolean;
  enabled?: (state: ToolbarState) => boolean;
  run: (editor: Editor) => void;
};

// E§3.6 toolbar2, student: Poništi Ponovi | Stil odlomka Podebljano Kurziv
// Popis Blok-citat; only what the V2 schema holds (list = bulletItem).
export const TOOLS: readonly Tool[] = [
  {
    key: "undo", label: t.toolbar.undo, group: "history", icon: "undo", keys: "Ctrl+Z",
    enabled: (s) => s.canUndo, run: (e) => e.chain().focus().undo().run(),
  },
  {
    key: "redo", label: t.toolbar.redo, group: "history", icon: "redo", keys: "Ctrl+Y",
    enabled: (s) => s.canRedo, run: (e) => e.chain().focus().redo().run(),
  },
  // Rendered as the block style menu; its items run BLOCK_STYLES.
  { key: "blockStyle", label: t.toolbar.blockStyle, group: "block", run: () => undefined },
  {
    key: "bold", label: t.toolbar.bold, group: "block", icon: "bold", keys: "Ctrl+B",
    pressed: (s) => s.bold, run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: "italic", label: t.toolbar.italic, group: "block", icon: "italic", keys: "Ctrl+I",
    pressed: (s) => s.italic, run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: "bulletItem", label: t.toolbar.bulletItem, group: "block", icon: "bulletList",
    pressed: (s) => s.bulletItem, run: (e) => e.chain().focus().toggleNode("bulletItem", "paragraph").run(),
  },
  {
    key: "quote", label: t.toolbar.quote, group: "block", icon: "quote",
    pressed: (s) => s.quote, run: (e) => e.chain().focus().toggleNode("quote", "paragraph").run(),
  },
];

const titleOf = (tool: Tool) => (tool.keys ? `${tool.label} (${tool.keys})` : tool.label);
const ariaKeys = (keys: string | undefined) => keys?.replace("Ctrl", "Control");

/** Whether the toolbar's own buttons have wrapped onto a second line. */
function wraps(toolbar: HTMLElement): boolean {
  const buttons = toolbar.querySelectorAll<HTMLElement>("[data-roving]");
  if (buttons.length < 2) return false;
  const first = buttons[0]!.getBoundingClientRect();
  const last = buttons[buttons.length - 1]!.getBoundingClientRect();
  return last.top >= first.bottom - 1;
}

const THEMES: readonly { key: SheetTheme; label: string }[] = [
  { key: "dark", label: t.workspace.sheetThemeDark },
  { key: "light", label: t.workspace.sheetThemeLight },
];

/**
 * The same toolbar for any editor, e.g. the public sandbox (DAN-354), which
 * has no local document: it only runs that editor's own commands.
 */
export default function EditorToolbarFor({ editor }: { editor: Editor | null }) {
  const state = useEditorState({ editor, selector: ({ editor: e }) => stateOf(e) }) ?? IDLE;
  const theme = useSheetTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState<string>(TOOLS[0]!.key);
  const [openMenu, setOpenMenu] = useState<"more" | "view" | "blockStyle" | null>(null);
  const [collapsed, setCollapsed] = useState(0);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  // Set when a new width closed a menu that held focus (review524, 1 and 2).
  const refocusRef = useRef(false);

  // A new width starts again with every tool shown (prototype fitToolbar).
  // It also closes "Više": its tools are measured again, so the menu goes
  // away for a moment, and left open in state it would open again later by
  // itself and take focus from the sheet. Focus that was in it goes back to
  // the toolbar once the new layout has settled, never to the page body.
  // "Prikaz" never moves, so a new width leaves it as it is.
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next === widthRef.current) return;
      widthRef.current = next;
      if (element.querySelector(".editor-menu--more")?.contains(document.activeElement)) refocusRef.current = true;
      setOpenMenu((open) => (open === "more" ? null : open));
      setCollapsed(0);
      setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Each pass that still wraps moves one more heading into "Više", before paint.
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;
    if (collapsed < MAX_COLLAPSED && wraps(element)) {
      setCollapsed(collapsed + 1);
      return;
    }
    if (refocusRef.current) {
      refocusRef.current = false;
      element.querySelector<HTMLElement>("[data-roving][tabindex='0']")?.focus();
    }
  }, [collapsed, width]);

  const { shown, more } = splitTools(TOOLS, collapsed);
  const moreOpen = openMenu === "more" && more.length > 0;
  const usableOf = (tool: Tool) => state.editable && (tool.enabled?.(state) ?? true);
  const style = blockStyleOf(state);
  const rovingKeys = [...shown.map((tool) => tool.key), ...(more.length ? ["more"] : []), "view"];
  const stop = rovingKeys.includes(focusKey) ? focusKey : rovingKeys[0];

  // Checked again at the click: a sign-out stops writing without a render.
  const run = (tool: Tool): boolean => {
    if (!usableOf(tool) || !editor || editor.isDestroyed || !editor.isEditable) return false;
    tool.run(editor);
    return true;
  };

  // Roving focus between the toolbar's own buttons; Tab leaves the toolbar.
  // Keys inside an open menu are the menu's own and never reach here.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-roving]") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = rovingIndex(event.key, at, buttons.length);
    if (next === -1) return;
    event.preventDefault();
    setOpenMenu(null);
    setFocusKey(buttons[next]!.dataset.roving!);
    buttons[next]!.focus();
  };

  return (
    <div
      ref={listRef}
      className="editor-toolbar"
      role="toolbar"
      aria-label={t.toolbar.label}
      onKeyDown={onKeyDown}
    >
      {shown.map((tool, index) => {
        const usable = usableOf(tool);
        const opensGroup = index > 0 && shown[index - 1]!.group !== tool.group;
        const sep = opensGroup ? <span className="editor-toolbar__sep" aria-hidden="true" /> : null;
        if (tool.key === "blockStyle") {
          // The prototype's select: names the current style, or "Stil odlomka" when none is one.
          return (
            <Fragment key={tool.key}>
              {sep}
              <ToolbarMenu
                className={styles.style}
                label={style ? BLOCK_STYLES.find(({ key }) => key === style)!.label : t.toolbar.blockStyle}
                menuLabel={t.toolbar.blockStyleMenu}
                roving="blockStyle"
                tabIndex={stop === "blockStyle" ? 0 : -1}
                disabled={!state.editable}
                // Never gated on editable: a menu hidden that way would reopen by itself.
                open={openMenu === "blockStyle"}
                onOpenChange={(open) => {
                  setFocusKey("blockStyle");
                  setOpenMenu(open ? "blockStyle" : null);
                }}
                items={BLOCK_STYLES.map(({ key, label }) => ({
                  key, label, role: "menuitemradio", checked: style === key, disabled: !state.editable,
                }))}
                // The command refocuses the sheet, so the caret stays where it was.
                onSelect={(key) => {
                  const chosen = BLOCK_STYLES.find((candidate) => candidate.key === key);
                  if (!chosen || !editor || editor.isDestroyed || !editor.isEditable) return "keep";
                  chosen.run(editor);
                  return "close";
                }}
              />
            </Fragment>
          );
        }
        return (
          <Fragment key={tool.key}>
            {sep}
            <button
              type="button"
              className={`btn editor-toolbar__button ${styles.icon}`}
              data-tool={tool.key}
              data-roving={tool.key}
              aria-label={tool.label}
              aria-keyshortcuts={ariaKeys(tool.keys)}
              title={titleOf(tool)}
              aria-pressed={tool.pressed ? tool.pressed(state) : undefined}
              aria-disabled={usable ? undefined : "true"}
              tabIndex={tool.key === stop ? 0 : -1}
              // Keeps the selection in the sheet; the command refocuses it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setFocusKey(tool.key);
                run(tool);
              }}
            >
              {tool.icon ? <Icon name={tool.icon} size={18} /> : tool.label}
            </button>
          </Fragment>
        );
      })}
      {more.length ? (
        <ToolbarMenu
          className="editor-menu--more"
          label={t.toolbar.more}
          menuLabel={t.toolbar.moreMenu}
          roving="more"
          tabIndex={stop === "more" ? 0 : -1}
          open={moreOpen}
          onOpenChange={(open) => {
            setFocusKey("more");
            setOpenMenu(open ? "more" : null);
          }}
          items={more.map((tool) => ({
            key: tool.key,
            label: tool.label,
            ...(tool.icon ? { glyph: <Icon name={tool.icon} /> } : {}),
            role: tool.pressed ? "menuitemcheckbox" : "menuitem",
            checked: tool.pressed ? tool.pressed(state) : false,
            disabled: !usableOf(tool),
          }))}
          // Same command, same check as the button; it refocuses the sheet.
          onSelect={(key) => {
            const tool = more.find((candidate) => candidate.key === key);
            return tool && run(tool) ? "close" : "keep";
          }}
        />
      ) : null}
      <ToolbarMenu
        className="editor-menu--end"
        label={t.toolbar.view}
        menuLabel={t.toolbar.viewMenu}
        groupLabel={t.toolbar.sheet}
        roving="view"
        tabIndex={stop === "view" ? 0 : -1}
        open={openMenu === "view"}
        onOpenChange={(open) => {
          setFocusKey("view");
          setOpenMenu(open ? "view" : null);
        }}
        items={THEMES.map(({ key, label }) => ({
          key, label, role: "menuitemradio", checked: theme === key,
        }))}
        onSelect={(key) => {
          setSheetTheme(key === "light" ? "light" : "dark");
          return "close-return";
        }}
      />
    </div>
  );
}
