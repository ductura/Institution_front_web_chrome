/** Pure rules of the comment thread (UI-8A). A comment is a derived view of a SEPARATE record with an anchor (ARCHITECTURE §5a); never a mark in the document. */
export type CommentEntry = {
  id: string;
  author: string;
  /** Already formatted for display by the page (e.g. "12. 11. 2026."). */
  at: string;
  text: string;
  /** Marks the mentor's entries visually; the text of the role comes from the page. */
  mentor?: boolean;
};

export type CommentThreadData = {
  id: string;
  /** The anchored passage, shown as a quote; empty for a general comment. */
  anchor?: string;
  resolved: boolean;
  entries: readonly CommentEntry[];
};

/** A reply is sent trimmed and only if something is left. */
export function replyText(raw: string): string | null {
  const text = raw.trim();
  return text === "" ? null : text;
}

/** Ctrl/Cmd+Enter sends, Escape clears; plain Enter stays a new line. */
export function replyKeyAction(key: string, ctrl: boolean, meta: boolean): "send" | "cancel" | null {
  if (key === "Enter" && (ctrl || meta)) return "send";
  if (key === "Escape") return "cancel";
  return null;
}

/** A resolved thread starts collapsed to its first entry. */
export function visibleEntries(thread: CommentThreadData, expanded: boolean): readonly CommentEntry[] {
  return thread.resolved && !expanded ? thread.entries.slice(0, 1) : thread.entries;
}
