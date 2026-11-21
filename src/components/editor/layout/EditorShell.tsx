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
  closeLabel: string;
};

export function EditorShellFrame({ header, tools, rail, panel, status, children, controls, className, style, focus }: {
  header: ReactNode; tools?: ReactNode; rail?: ReactNode; panel?: ReactNode; status: ReactNode;
  children: ReactNode; controls?: ReactNode; className?: string; style?: CSSProperties; focus?: boolean;
}) {
  return <div className={[styles.app, className].filter(Boolean).join(" ")} style={style} data-focus={focus}>
    <div className={styles.top} data-editor-chrome>{header}</div>
    {tools != null && <div className={styles.tools} data-editor-chrome>{tools}</div>}
    <div className={styles.body}>
      {rail}
      <main id="sadrzaj" className={styles.stage}>{children}</main>
      {panel}
    </div>
    <div className={styles.status}>{status}</div>
    {controls}
  </div>;
}

/**
 * Header, tools, rail, sheet area, panel and status bar in the prototype's
 * measures (E§1). Rail and panel become drawers at 1250 and 1050 px; Esc and
 * the scrim close them. Widths come from the writer's local choice.
 */
export default function EditorShell({ header, tools = null, rail = null, panel = null, status, children, railLabel, panelLabel, closeLabel }: EditorShellProps) {
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
  const cls = drawer === "rail" ? styles.railOpen : drawer === "panel" ? styles.panelOpen : undefined;
  return (
    <EditorShellFrame className={cls} style={vars} header={<>
        {rail !== null && (
          <button type="button" className={styles.onlyNarrow} aria-label={railLabel} aria-expanded={drawer === "rail"} onClick={() => setDrawer(drawer === "rail" ? null : "rail")}>≡</button>
        )}
        {header}
        <span className={styles.grow} />
        {panel !== null && (
          <button type="button" className={styles.onlyMid} aria-label={panelLabel} aria-expanded={drawer === "panel"} onClick={() => setDrawer(drawer === "panel" ? null : "panel")}>▥</button>
        )}
      </>}
      tools={tools !== null ? <div role="toolbar">{tools}</div> : null}
      rail={rail !== null && <aside className={styles.rail} aria-label={railLabel}>{rail}</aside>}
      panel={<>
        {panel !== null && <aside className={styles.panel} aria-label={panelLabel}>
          <button type="button" className={styles.close} onClick={() => setDrawer(null)}>{closeLabel}</button>
          {panel}
        </aside>}
        <div className={styles.scrim} onClick={() => setDrawer(null)} />
      </>} status={status}>{children}</EditorShellFrame>
  );
}
