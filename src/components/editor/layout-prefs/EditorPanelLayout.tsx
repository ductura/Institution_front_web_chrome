"use client";

import { Button, Drawer, ToastRegion, useToasts } from "@ductura/ui";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { editorPanelLayoutsHr as t, messagesHr } from "@/lib/i18n/messages.hr";

import { useSheetTheme } from "../../shell/useSheetTheme";
import sheet from "../EditorPage.module.css";
import { EditorShellFrame } from "../layout/EditorShell";
import { BREAKPOINTS, DEFAULT_SETTINGS, loadSettings, PANEL_WIDTHS, RAIL_WIDTHS } from "../layout/layout-settings";
import shell from "../layout/Layout.module.css";
import styles from "../SidePanels.module.css";
import { LeftPanel, type LeftSections } from "./LeftPanel";
import { PanelSettings } from "./PanelSettings";
import { DEFAULT_PREFERENCES, effectiveLayout, readPreferences, writePreferences, type LayoutPreferences, type Side } from "./preferences";
import { RightPanel, type PanelGroup, type RightSections } from "./RightPanel";

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
};

export function EditorPanelLayout({ header, tools, status, title, children, leftSections, rightSections }: EditorPanelLayoutProps) {
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
      if (event.defaultPrevented || event.isComposing || event.repeat || document.querySelector("dialog:modal")) return;
      const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === ".";
      if (!shortcut && !(focus && event.key === "Escape")) return;
      event.preventDefault();
      moveFocus.current = document.activeElement === exit.current || document.activeElement === enter.current;
      setFocus(!focus);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focus]);

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
  const left = <LeftPanel layout={leftLayout} sections={leftSections} onJump={close}
    settings={<PanelSettings side="left" value={prefs.left} onChange={(value) => setSide("left", value)} />} />;
  const right = <RightPanel layout={rightLayout} sections={rightSections} drawer={narrowPanel}
    selection={rightLayout === "b" ? contextView : selection} onSelect={rightLayout === "b" ? setContextView : setSelection}
    settings={<PanelSettings side="right" value={prefs.right} onChange={(value) => setSide("right", value)} />} />;

  return <EditorShellFrame className={styles.workspace} focus={focus} style={vars}
    header={<>
      <Button tone="quiet" aria-label={w.structureLabel} aria-expanded={narrowRail ? drawer === "left" : railVisible}
        onClick={() => narrowRail ? setDrawer("left") : setRailVisible(!railVisible)}>≡</Button>
      {header}
      <span className={shell.grow} />
      <Button ref={enter} tone="quiet" aria-label={t.focus} aria-keyshortcuts="Control+. Meta+."
        onClick={() => { moveFocus.current = true; setFocus(true); }}>◎</Button>
      {narrowPanel && <Button tone="quiet" aria-label={w.panelTabs} aria-expanded={drawer === "right"}
        onClick={() => setDrawer("right")}>▥</Button>}
    </>} tools={tools} status={status}
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
