"use client";

// WEB-2136 (paritet E): the shell's view bar for /rad: "Pisanje / Kako vidi
// nastavnik" (the teacher's view is a real second user, not a switch of this
// state: without its route the button says so), "Samo naslovi" with its banner,
// and the width of the two panels. Nothing here writes to the server.
import { useEffect, useState, type ReactNode } from "react";
import { Button, SegmentedControl } from "@ductura/ui";

import { TopBarSlot } from "../../../../../../src/components/editor/WorkspaceTopBar.tsx";
import { shellHr as t } from "./messages.hr";
import styles from "./ShellView.module.css";
import {
  DEFAULT_VIEW, keepWidths, readWidths, shellCss, WIDTH_KEYS, withOutline, withWidth, type ShellMode, type ShellView as View, type Side,
} from "./shell-model";

export type ShellViewProps = {
  /** The topBar the page already has; the view bar goes beside it. */
  readonly children?: ReactNode;
  /** Where "Kako vidi nastavnik" leads; undefined while there is no such view. */
  readonly teacherHref?: string;
  readonly mode?: ShellMode;
};

export function ShellView({ children, teacherHref, mode = "write" }: ShellViewProps) {
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  useEffect(() => setView((v) => ({ ...v, widths: readWidths() })), []);
  // Typing is off while only the headings are shown: the editor is inert for that time.
  useEffect(() => {
    if (!view.outlineOnly) return;
    const editors = Array.from(document.querySelectorAll<HTMLElement>(".ProseMirror"));
    editors.forEach((e) => { e.inert = true; });
    return () => editors.forEach((e) => { e.inert = false; });
  }, [view.outlineOnly]);

  const pick = (side: Side, size: (typeof WIDTH_KEYS)[number]) => {
    const next = withWidth(view, side, size);
    setView(next);
    keepWidths(next.widths);
  };
  // The switch sits in the top bar after the title (prototype `.seg`); "Kako vidi nastavnik" is a link while there is a view to go to.
  const teacherLabel = <><span className={styles.wide}>{t.teacher}</span><span className={styles.narrow}>{t.teacherShort}</span></>;
  const slot = (
    <>
      <div data-shell-mode={mode} style={{ display: "contents" }}>
        {teacherHref === undefined ? (
          <>
            <span id="shell-teacher-note" className={styles.note}>{t.teacherUnavailable}</span>
            <SegmentedControl label={t.modeLabel} value={mode}
              options={[
                { value: "write", label: t.write },
                { value: "teacher", label: teacherLabel, ariaLabel: t.teacher, disabled: true, title: t.teacherUnavailable },
              ]} />
          </>
        ) : (
          <SegmentedControl label={t.modeLabel} value={mode}
            options={[{ value: "write", label: t.write }, { value: "teacher", label: teacherLabel, ariaLabel: t.teacher, href: teacherHref }]} />
        )}
      </div>
      <details className={styles.view}>
        <summary>{t.viewMenu} ▾</summary>
        <div className={styles.menu}>
          <div className={styles.group}>
            <Button tone="quiet" size="small" aria-pressed={view.outlineOnly} title={t.outlineOnlyTitle}
              onClick={() => setView(withOutline(view, !view.outlineOnly))}>{t.outlineOnly}</Button>
          </div>
          {(["rail", "panel"] as const).map((side) => (
            <div key={side} className={styles.group} role="group" aria-label={`${t.widthsLabel}: ${t[side]}`}>
              <span>{t[side]}</span>
              <div className={styles.row}>
                {WIDTH_KEYS.map((size) => (
                  <Button key={size} tone="quiet" size="small" aria-pressed={view.widths[side] === size} onClick={() => pick(side, size)}>{t.width[size]}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      {view.outlineOnly ? (
        <p role="status" className={styles.banner}>{t.outlineBanner}{" "}
          <button type="button" onClick={() => setView(withOutline(view, false))}>{t.outlineResume}</button></p>
      ) : null}
    </>
  );
  return (
    <>
      <style>{shellCss(view)}</style>
      <TopBarSlot.Provider value={slot}>{children}</TopBarSlot.Provider>
    </>
  );
}
