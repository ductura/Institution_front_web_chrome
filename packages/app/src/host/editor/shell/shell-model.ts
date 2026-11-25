// WEB-2136 (paritet E, §1.2/§1.5/§1.12): the shell's view state as data. The
// widths are the editor's own (layout-settings: same numbers, same storage
// key, so the panel layout reads the choice at its next mount); the outline
// choice is kept in the tab only, as the prototype keeps `#ed.outline-only`.
import {
  loadSettings, onSettingsChange, PANEL_WIDTHS, RAIL_WIDTHS, saveSettings, type LayoutSettings, type PanelSize, type RailSize,
} from "../../../../../../src/components/editor/layout/layout-settings.ts";

export type ShellMode = "write" | "teacher";
export const WIDTH_KEYS = ["narrow", "medium", "wide"] as const;
export type Side = "rail" | "panel";

export type ShellView = { readonly outlineOnly: boolean; readonly widths: LayoutSettings };

export const DEFAULT_VIEW: ShellView = { outlineOnly: false, widths: { rail: "medium", panel: "medium" } };

/** The pixel width a side takes at a size. */
export const widthPx = (side: Side, size: RailSize | PanelSize): number =>
  side === "rail" ? RAIL_WIDTHS[size as RailSize] : PANEL_WIDTHS[size as PanelSize];

export function withWidth(view: ShellView, side: Side, size: (typeof WIDTH_KEYS)[number]): ShellView {
  return { ...view, widths: { ...view.widths, [side]: size } };
}

export const withOutline = (view: ShellView, outlineOnly: boolean): ShellView => ({ ...view, outlineOnly });

/**
 * The rules that apply the view to the panel layout and the editor. The layout
 * sets `--rail-w`/`--panel-w` inline, so the choice is made with !important
 * (min-width 1051 px, as the layout does for the panel). In "samo naslovi"
 * only h1–h3 are drawn.
 */
export function shellCss(view: ShellView): string {
  const rules = [
    `[style*="--rail-w"] { --rail-w: ${widthPx("rail", view.widths.rail)}px !important; }`,
    `@media (min-width: 1051px) { [style*="--panel-w"] { --panel-w: ${widthPx("panel", view.widths.panel)}px !important; } }`,
  ];
  if (view.outlineOnly) rules.push(`.ProseMirror > :not(h1):not(h2):not(h3) { display: none !important; }`);
  return rules.join("\n");
}

/** The stored widths, or the defaults; the stored value never throws. */
export const readWidths = (): LayoutSettings => loadSettings();
/** ED-39: a width chosen elsewhere on the page (the dialog "Prilagodi panel"). */
export const watchWidths = (onChange: (widths: LayoutSettings) => void): (() => void) => onSettingsChange(onChange);
/** True when the browser kept the choice. */
export const keepWidths = (widths: LayoutSettings): boolean => saveSettings(widths);
