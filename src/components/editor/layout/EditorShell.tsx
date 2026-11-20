"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { PANEL_WIDTHS, RAIL_WIDTHS, loadSettings, type LayoutSettings, DEFAULT_SETTINGS } from "./layout-settings";
import styles from "./Layout.module.css";

export type EditorShellProps = {
  header: ReactNode;
  tools?: ReactNode;
  rail?: ReactNode;
  panel?: ReactNode;
  status: ReactNode;
  children: ReactNode;
  /** Names for the drawers' regions (Croatian, from the page's catalogue). */
  railLabel: string;
  panelLabel: string;
};

/**
 * Header, tools, rail, sheet area, panel and status bar in the prototype's
 * measures (E§1). Rail and panel become drawers at 1250 and 1050 px; Esc and
 * the scrim close them. Widths come from the writer's local choice.
 */
export default function EditorShell({ header, tools = null, rail = null, panel = null, status, children, railLabel, panelLabel }: EditorShellProps) {
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState<"rail" | "panel" | null>(null);
  useEffect(() => setSettings(loadSettings()), []);
  useEffect(() => {
    if (drawer === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const vars = { "--rail-w": `${RAIL_WIDTHS[settings.rail]}px`, "--panel-w": `${PANEL_WIDTHS[settings.panel]}px` } as CSSProperties;
  const cls = [styles.app, drawer === "rail" ? styles.railOpen : "", drawer === "panel" ? styles.panelOpen : ""].join(" ").trim();
  return (
    <div className={cls} style={vars}>
      <header className={styles.top}>
        {rail !== null && (
          <button type="button" className={styles.onlyNarrow} aria-label={railLabel} aria-expanded={drawer === "rail"} onClick={() => setDrawer(drawer === "rail" ? null : "rail")}>≡</button>
        )}
        {header}
        <span className={styles.grow} />
        {panel !== null && (
          <button type="button" className={styles.onlyMid} aria-label={panelLabel} aria-expanded={drawer === "panel"} onClick={() => setDrawer(drawer === "panel" ? null : "panel")}>▥</button>
        )}
      </header>
      {tools !== null && <div className={styles.tools} role="toolbar">{tools}</div>}
      <div className={styles.body}>
        {rail !== null && <aside className={styles.rail} aria-label={railLabel}>{rail}</aside>}
        <main id="sadrzaj" className={styles.stage}>{children}</main>
        {panel !== null && <aside className={styles.panel} aria-label={panelLabel}>{panel}</aside>}
        <div className={styles.scrim} onClick={() => setDrawer(null)} />
      </div>
      <div className={styles.status}>{status}</div>
    </div>
  );
}
