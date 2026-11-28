// WEB-2131: the menu of a right click in the text (more2 in the prototype): what the pointer is on decides what it
// offers. Shift + right click stays the browser's menu (the shared ContextMenu already leaves it alone). A locked
// work has no menu at all. Actions the host cannot do yet are shown disabled ("nedostupno"), never hidden.
import type { MenuEntry } from "@ductura/ui";

import { toolbarBehaviourHr as t } from "./messages.hr";

export type MenuRole = "student" | "teacher" | "collaborator";
export type MenuContext = {
  role: MenuRole; editable: boolean; hasSelection: boolean; canComment: boolean;
  /** ED-91: false greys out "U fusnotu" (no footnote can stand there) and "U blok-citat" (already a quote). */
  footnote?: boolean; inQuote?: boolean;
};

const item = (id: string, label: string, hint?: string, disabled = false): MenuEntry => ({ kind: "item", id, label, hint, disabled });
const heading = (label: string): MenuEntry => ({ kind: "heading", label });

/** null: no menu (a locked work for a student). A collaborator may only read and comment, so only the comment item shows. */
export function textMenuEntries(c: MenuContext): MenuEntry[] | null {
  if (c.role === "student" && !c.editable) return null;
  if (c.role === "collaborator") {
    // INVENTAR §7 t. 5: a collaborator reads and comments, nothing else.
    return [heading(t.menuSelected), item("comment", t.menuCommentSelected, "Ctrl+Alt+M", !c.hasSelection || !c.canComment)];
  }
  const comment = item("comment", c.role === "teacher" ? t.menuSendComment : t.menuCommentSelected, "Ctrl+Alt+M", !c.hasSelection || !c.canComment);
  if (c.role === "teacher") {
    return [heading(t.menuReview), comment, item("note", "Privatna bilješka", undefined, !c.hasSelection), item("confirm", "Zatraži potvrdu", undefined, !c.hasSelection)];
  }
  if (!c.hasSelection) return [heading(t.menuPlace), item("hole", t.quickHole), item("cite", t.quickCite, "@")];
  return [
    heading(t.menuSelected), comment, item("citeAfter", t.menuCiteAfter),
    heading(t.menuShape), item("bold", t.menuBold, "Ctrl+B"), item("italic", t.menuItalic, "Ctrl+I"),
    heading(t.menuMove), item("toQuote", t.menuToQuote, undefined, c.inQuote === true), item("toFootnote", t.menuToFootnote, undefined, c.footnote === false), item("stash", t.menuStash),
    item("cut", t.menuCut, "Ctrl+X"), item("copy", t.menuCopy, "Ctrl+C"),
  ];
}
