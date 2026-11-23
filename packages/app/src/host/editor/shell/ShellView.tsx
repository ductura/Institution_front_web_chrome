"use client";

// WEB-2136 (paritet E): the shell's view bar for /rad: "Pisanje / Kako vidi
// nastavnik" (the teacher's view is a real second user, not a switch of this
// state: without its route the button says so), "Samo naslovi" with its banner,
// and the width of the two panels. Nothing here writes to the server.
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@ductura/ui";

import { EditorShortcutListHost } from "../shortcuts/EditorShortcutListHost";
import { shellHr as t } from "./messages.hr";
import {
  DEFAULT_VIEW, keepWidths, readWidths, shellCss, WIDTH_KEYS, withOutline, withWidth, type ShellMode, type ShellView as View, type Side,
} from "./shell-model";

export type ShellViewProps = {
  /** The topBar the page already has; the view bar goes beside it. */
  readonly children?: ReactNode;
  /** Where "Kako vidi nastavnik" leads; undefined while there is no such view. */
  readonly teacherHref?: string;
  readonly mode?: ShellMode;
  /** Whether the work can be written in; a locked work's shortcut list omits the writing keys. */
  readonly editable?: boolean;
};

export function ShellView({ children, teacherHref, mode = "write", editable = true }: ShellViewProps) {
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
  return (
    <>
      <style>{shellCss(view)}</style>
      {children}
      <div role="group" aria-label={t.modeLabel} data-shell-mode={mode}>
        <Button tone="quiet" aria-pressed={mode === "write"} disabled={mode === "write"}>{t.write}</Button>
        {teacherHref === undefined ? (
          <>
            <Button tone="quiet" disabled aria-describedby="shell-teacher-note">{t.teacher}</Button>
            <span id="shell-teacher-note">{t.teacherUnavailable}</span>
          </>
        ) : (
          <a className="btn" href={teacherHref} aria-pressed={mode === "teacher"}>{t.teacher}</a>
        )}
        <Button tone="quiet" aria-pressed={view.outlineOnly} title={t.outlineOnlyTitle}
          onClick={() => setView(withOutline(view, !view.outlineOnly))}>{t.outlineOnly}</Button>
        {/* PIL-D8-PRECACI (P-D8): the shortcut list, from its button or "?" outside a text field. */}
        <EditorShortcutListHost editable={editable} />
      </div>
      {(["rail", "panel"] as const).map((side) => (
        <div key={side} role="group" aria-label={`${t.widthsLabel}: ${t[side]}`}>
          {WIDTH_KEYS.map((size) => (
            <Button key={size} tone="quiet" aria-pressed={view.widths[side] === size} onClick={() => pick(side, size)}>{t.width[size]}</Button>
          ))}
        </div>
      ))}
      {view.outlineOnly ? (
        <p role="status">{t.outlineBanner}{" "}
          <Button tone="quiet" onClick={() => setView(withOutline(view, false))}>{t.outlineResume}</Button></p>
      ) : null}
    </>
  );
}
