/**
 * ED-45 (P2-17): a part of the editor that lives outside the panel layout (a
 * mark's popover in the text, the chapter sheet) asks the right panel to open
 * one of its groups, as the prototype's `data-act="tab"` does ("Poveži u
 * Literaturi" opens Literatura). The layout opens the group in every layout
 * (tab, context view, icon strip), opens the drawer on a narrow screen and
 * leaves focus mode, so the group is really in front of the person.
 */
import type { PanelGroup } from "./RightPanel";

export const OPEN_PANEL_EVENT = "ductura:open-panel";

const GROUPS: readonly PanelGroup[] = ["sources", "comments", "review", "work", "assistant"];

/** Asks the panel layout of this page to open `group`. */
export function requestPanel(group: PanelGroup, target: EventTarget = document): void {
  target.dispatchEvent(new CustomEvent(OPEN_PANEL_EVENT, { detail: group }));
}

/** The group an event asks for; anything else (an old or foreign event) asks for nothing. */
export function requestedPanel(event: Event): PanelGroup | null {
  const detail = (event as CustomEvent<unknown>).detail;
  return GROUPS.find((group) => group === detail) ?? null;
}
