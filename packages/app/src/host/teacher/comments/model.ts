import type { ThreadComment } from "@/client/comments";
import { formatDateTimeHr } from "@/lib/i18n/hr";

import { teacherCommentsMessages as t } from "./messages.hr";

const QUOTE_MAX = 40;

/** Thread heading: „Komentar uz „Ovaj odnos dodatno slabi…””; a long quote is cut with an ellipsis. */
export function threadTitle(quote: string | null): string {
  if (quote === null || quote.trim() === "") return t.title;
  const flat = quote.replace(/\s+/g, " ").trim();
  const short = flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX).trimEnd()}…` : flat;
  return t.threadTitle.replace("{quote}", short);
}

/** „uz verziju V3” for a thread written on revision 3; null for a thread without a revision (INT-15). */
export function revisionLabel(revision: number | null): string | null {
  return revision === null ? null : t.revision.replace("{n}", String(revision));
}

/** Entry author line: „Vi · 3. 11. 2026. u 9:15” (own entries are „Vi”, never a name). */
export function entryWho(comment: Pick<ThreadComment, "isOwn" | "role" | "createdWindow">): string {
  const who = comment.isOwn ? t.own : comment.role === "teacher" ? t.teacher : t.student;
  return `${who} · ${formatDateTimeHr(comment.createdWindow)}`;
}
