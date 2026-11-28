"use client";

import { Button, Drawer, ToastRegion, useToasts } from "@ductura/ui";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import { useSheetTheme } from "../../shell/useSheetTheme";
import sheet from "../EditorPage.module.css";
import { EditorShellFrame } from "../layout/EditorShell";
import {
  BREAKPOINTS, DEFAULT_SETTINGS, loadSettings, onSettingsChange, PANEL_WIDTHS, RAIL_WIDTHS, saveSettings,
} from "../layout/layout-settings";
import shell from "../layout/Layout.module.css";
import styles from "../SidePanels.module.css";
import { LeftPanel, type LeftSections } from "./LeftPanel";
import { PanelSettings } from "./PanelSettings";
import { FOCUS_MODE_EVENT, togglesFocus } from "./focus-mode";
import { OPEN_PANEL_EVENT, requestedPanel } from "./open-panel";
import { DEFAULT_PREFERENCES, effectiveLayout, readPreferences, rowShows, writePreferences, type LayoutPreferences, type Side } from "./preferences";
import { RightPanel, type PanelGroup, type RightSections } from "./RightPanel";
import { STRUCTURE_RAIL_EVENT, togglesRail } from "./structure-rail";

const w = messagesHr.workspace;
const serverSnapshot = () => false;

function atMost(width: number) {
  const query = `(max-width: ${width}px)`;
  return {
    subscribe(listener: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    snapshot: () => window.matchMedia(query).matches,
  };
}

const railQuery = atMost(BREAKPOINTS.rail);
const panelQuery = atMost(BREAKPOINTS.panel);
const phoneQuery = atMost(BREAKPOINTS.phone);

export type EditorPanelLayoutProps = {
  header: ReactNode;
  tools: ReactNode;
  status: ReactNode;
  title: string;
  children: ReactNode;
  leftSections?: LeftSections;
  rightSections?: RightSections;
  renderWork?: (closeDrawer: () => void) => ReactNode;
};

export function EditorPanelLayout({ header, tools, status, title, children, leftSections, rightSections, renderWork }: EditorPanelLayoutProps) {
  const theme = useSheetTheme();
  const narrowRail = useSyncExternalStore(railQuery.subscribe, railQuery.snapshot, serverSnapshot);
  const narrowPanel = useSyncExternalStore(panelQuery.subscribe, panelQuery.snapshot, serverSnapshot);
  const phone = useSyncExternalStore(phoneQuery.subscribe, phoneQuery.snapshot, serverSnapshot);
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);
  const [sizes, setSizes] = useState(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState<Side | null>(null);
  const [railVisible, setRailVisible] = useState(true);
  const [selection, setSelection] = useState<PanelGroup | null>("sources");
  const [contextView, setContextView] = useState<PanelGroup | null>(null);
  const [focus, setFocus] = useState(false);
  const enter = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const { toasts, show, dismiss } = useToasts();

  useEffect(() => {
    setPrefs(readPreferences());
    setSizes(loadSettings());
    // ED-39: a width chosen in the shell's "Raspored" menu shows at once, and in the dialog.
    return onSettingsChange(setSizes);
  }, []);

  useEffect(() => {
    if ((drawer === "left" && !narrowRail) || (drawer === "right" && !narrowPanel)) setDrawer(null);
  }, [drawer, narrowRail, narrowPanel]);

  useEffect(() => {
    if (moveFocus.current) (focus ? exit : enter).current?.focus();
    moveFocus.current = false;
    if (focus) {
      const notice = show(t.focusNotice);
      return () => dismiss(notice);
    }
  }, [focus, show, dismiss]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!togglesFocus(event, focus, document.querySelector("dialog:modal") !== null)) return;
      event.preventDefault();
      moveFocus.current = document.activeElement === exit.current || document.activeElement === enter.current;
      setFocus(!focus);
    };
    const onRequest = () => setFocus(true);
    document.addEventListener("keydown", onKey);
    document.addEventListener(FOCUS_MODE_EVENT, onRequest);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(FOCUS_MODE_EVENT, onRequest);
    };
  }, [focus]);

  // ED-112: Ctrl+\ and the palette's "Struktura rada" show or hide the structure, as its button does.
  // In focus mode the structure is hidden with everything else, so asking for it leaves focus mode
  // and shows it, rather than changing something the person cannot see.
  useEffect(() => {
    const toggle = () => {
      const narrow = railQuery.snapshot();
      if (focus) {
        setFocus(false);
        if (narrow) setDrawer("left"); else setRailVisible(true);
        return;
      }
      if (narrow) setDrawer((open) => open === "left" ? null : "left");
      else setRailVisible((visible) => !visible);
    };
    const onKey = (event: KeyboardEvent) => {
      // The structure's own drawer is a modal dialog too; Ctrl+\ closes it, any other dialog keeps the key.
      const own = drawer === "left" && railQuery.snapshot() ? 1 : 0;
      if (!togglesRail(event, document.querySelectorAll("dialog:modal").length > own)) return;
      event.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener(STRUCTURE_RAIL_EVENT, toggle);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(STRUCTURE_RAIL_EVENT, toggle);
    };
  }, [focus, drawer]);

  // ED-45: a mark's popover or the chapter sheet asks for a group ("Poveži u Literaturi" → Literatura).
  useEffect(() => {
    const onRequest = (event: Event) => {
      const group = requestedPanel(event);
      if (!group) return;
      setFocus(false);
      setSelection(group);
      setContextView(group);
      if (panelQuery.snapshot()) setDrawer("right");
    };
    document.addEventListener(OPEN_PANEL_EVENT, onRequest);
    return () => document.removeEventListener(OPEN_PANEL_EVENT, onRequest);
  }, []);

  const setSide = (side: Side, value: LayoutPreferences[Side]) => {
    const next = { ...prefs, [side]: value };
    writePreferences(next);
    setPrefs(next);
    if (side === "right") { setSelection("sources"); setContextView(null); }
  };
  const leftLayout = effectiveLayout(prefs.left, phone);
  const rightLayout = effectiveLayout(prefs.right, phone);
  const vars = { "--rail-w": `${RAIL_WIDTHS[sizes.rail]}px`, "--panel-w": `${PANEL_WIDTHS[sizes.panel]}px` } as CSSProperties;
  const close = () => setDrawer(null);
  const pickWidth = (key: "rail" | "panel") => (size: "narrow" | "medium" | "wide") => { saveSettings({ ...sizes, [key]: size }); setSizes({ ...sizes, [key]: size }); };
  // ED-39 "Gustoća: Zbijeno": one class on the side's content; `display: contents` keeps the layout.
  // Always the same wrapper, only its density changes: a new element would mount the side again and
  // close the open dialog, the open tab and the comments with it.
  const withDensity = (side: Side, node: ReactNode) => <div className={styles.density} data-density={prefs[side].dense ? "dense" : "airy"}>{node}</div>;
  const left = withDensity("left", <LeftPanel layout={leftLayout} sections={leftSections} onJump={close} row={rowShows(prefs.left)} parts={prefs.left}
    settings={<PanelSettings side="left" value={prefs.left} onChange={(value) => setSide("left", value)}
      width={sizes.rail} onWidth={pickWidth("rail")} />} />);
  const sections = renderWork ? { ...rightSections, work: renderWork(close) } : rightSections;
  const right = withDensity("right", <RightPanel layout={rightLayout} sections={sections} drawer={narrowPanel}
    selection={rightLayout === "b" ? contextView : selection} onSelect={rightLayout === "b" ? setContextView : setSelection}
    settings={<PanelSettings side="right" value={prefs.right} onChange={(value) => setSide("right", value)}
      width={sizes.panel} onWidth={pickWidth("panel")} />} />);

  return <EditorShellFrame className={styles.workspace} focus={focus} style={vars}
    header={<>
      <Button tone="quiet" aria-label={w.structureLabel} aria-expanded={narrowRail ? drawer === "left" : railVisible}
        aria-keyshortcuts="Control+\ Meta+\"
        onClick={() => narrowRail ? setDrawer("left") : setRailVisible(!railVisible)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 4.5h12M3 9h8M3 13.5h10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </Button>
      {header}
      <span className={shell.grow} />
      {narrowPanel && <Button tone="quiet" aria-label={w.panelTabs} aria-expanded={drawer === "right"}
        onClick={() => setDrawer("right")}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" stroke="currentColor" strokeWidth="1.5" fill="none">
          <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" /><path d="M11 3.5v11" />
        </svg>
      </Button>}
    </>} tools={<>
      {tools}
      <Button ref={enter} tone="quiet" aria-label={t.focus} aria-keyshortcuts="Control+. Meta+."
        onClick={() => { moveFocus.current = true; setFocus(true); }}>◎</Button>
    </>} status={status}
    rail={!narrowRail && railVisible && <aside className={`${shell.rail} ${styles.workspaceSide}`} aria-label={w.structureLabel}>{left}</aside>}
    panel={!narrowPanel && <aside className={`${shell.panel} ${styles.workspaceSide} ${rightLayout === "c" && selection === null ? styles.collapsedPanel : ""}`}
      aria-label={w.panelTabs}>{right}</aside>}
    controls={<>
    {focus && <div className={styles.focusControls}>
      <Button ref={exit} tone="quiet" onClick={() => { moveFocus.current = true; setFocus(false); }}>{t.exitFocus}</Button>
    </div>}
    <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.notices} closeLabel={t.close} />
    {narrowRail && <Drawer side="left" open={drawer === "left" && !focus} title={w.structureLabel} closeLabel={t.close} onClose={close}>{left}</Drawer>}
    {narrowPanel && <div className={rightLayout === "c" ? styles.bottomDrawer : undefined}>
      <Drawer side="right" open={drawer === "right" && !focus} title={w.panelTabs} closeLabel={t.close} onClose={close}>{right}</Drawer>
    </div>}
    </>}>
    <article className={`sheet ${sheet.sheet}`} data-sheet-theme={theme} aria-label={w.documentLabel}>
      <h1 className={sheet.title}>{title}</h1>
      {children}
    </article>
  </EditorShellFrame>;
}
