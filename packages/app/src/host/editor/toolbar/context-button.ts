// WEB-2131: the context button of the toolbar (#tbCtx): it appears only where the cursor is on something that has
// its own actions, and offers them. Hidden while the work cannot be written in. The editor reports where the cursor
// is; this file turns that into the button and its menu, and the shell runs the action by its id.
import { toolbarBehaviourHr as t } from "./messages.hr";

/** Where the cursor is, as far as the toolbar cares; the shell works it out from the editor's selection. */
export type CursorPlace =
  | { kind: "text" }
  | { kind: "citation" }
  | { kind: "table" }
  | { kind: "image" }
  | { kind: "heading"; level: 1 | 2 | 3 }
  | { kind: "quote" }
  | { kind: "list" }
  | { kind: "variant" };

export type ContextItem = { id: string; label: string; hint?: string; checked?: boolean };
export type ContextButtonModel = { id: string; label: string; description: string; items: ContextItem[] };

/** The ids the shell has to handle. */
export const CONTEXT_ACTIONS = [
  "citation.open", "citation.remove", "object.edit", "object.remove", "heading.level2", "heading.level3",
  "heading.up", "heading.down", "heading.xref", "quote.back", "quote.cite", "list.leave", "variant.keep", "variant.ask",
] as const;
export type ContextAction = (typeof CONTEXT_ACTIONS)[number];

export function contextButton(place: CursorPlace, editable: boolean): ContextButtonModel | null {
  if (!editable) return null;
  switch (place.kind) {
    case "citation":
      return { id: "citation", label: t.contextCite, description: t.contextCiteDescription, items: [
        { id: "citation.open", label: t.contextCiteOpen }, { id: "citation.remove", label: t.contextCiteRemove },
      ] };
    case "table":
    case "image":
      return { id: place.kind, label: place.kind === "table" ? t.contextTable : t.contextImage, description: t.contextObjectDescription, items: [
        { id: "object.edit", label: t.contextEdit }, { id: "object.remove", label: t.contextRemove },
      ] };
    case "heading":
      // The title of the work (level 1) has no level or position to change.
      if (place.level === 1) return null;
      return { id: "heading", label: t.contextHeading, description: t.contextHeadingDescription, items: [
        { id: "heading.level2", label: t.contextChapter, checked: place.level === 2 },
        { id: "heading.level3", label: t.contextSubchapter, checked: place.level === 3 },
        { id: "heading.up", label: t.contextMoveUp, hint: "Alt+Shift+↑" },
        { id: "heading.down", label: t.contextMoveDown, hint: "Alt+Shift+↓" },
        { id: "heading.xref", label: t.contextXref },
      ] };
    case "quote":
      return { id: "quote", label: t.contextQuote, description: t.contextQuoteDescription, items: [
        { id: "quote.back", label: t.contextQuoteBack }, { id: "quote.cite", label: t.contextQuoteCite },
      ] };
    case "list":
      return { id: "list", label: t.contextList, description: t.contextListDescription, items: [{ id: "list.leave", label: t.contextListLeave }] };
    case "variant":
      return { id: "variant", label: t.contextVariant, description: t.contextVariantDescription, items: [
        { id: "variant.keep", label: t.contextVariantKeep }, { id: "variant.ask", label: t.contextVariantAsk },
      ] };
    default:
      return null;
  }
}

/** The place, most specific first, from what the editor says is true at the cursor. */
export function placeFromFlags(flags: { citation?: boolean; table?: boolean; image?: boolean; headingLevel?: number; quote?: boolean; list?: boolean; variant?: boolean }): CursorPlace {
  if (flags.citation) return { kind: "citation" };
  if (flags.table) return { kind: "table" };
  if (flags.image) return { kind: "image" };
  if (flags.headingLevel !== undefined && flags.headingLevel >= 1) return { kind: "heading", level: Math.min(3, Math.trunc(flags.headingLevel)) as 1 | 2 | 3 };
  if (flags.variant) return { kind: "variant" };
  if (flags.quote) return { kind: "quote" };
  if (flags.list) return { kind: "list" };
  return { kind: "text" };
}
