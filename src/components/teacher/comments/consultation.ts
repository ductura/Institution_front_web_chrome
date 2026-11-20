import { messagesHr } from "@/lib/i18n/messages.hr";

import type { PlacedThread } from "../TeacherComments";

const t = messagesHr.comments;
const tp = messagesHr.teacherComments.consultation;

/** The print input consists only of shared, open threads with a place in the shown work. */
export function consultationEntries(placed: readonly PlacedThread[], nodeOrder: readonly { id: string }[]) {
  const positions = new Map(nodeOrder.map((node, index) => [node.id, index]));
  return placed.flatMap(({ thread, range }) => {
    if (thread.state === "resolved" || !range || !thread.anchor) return [];
    const position = positions.get(range.nodeId);
    if (position === undefined) return [];
    const messages = thread.comments.flatMap(({ id, role, body, isOwn }) => (
      body === null ? [] : [{ id, text: `${isOwn ? t.own : t[role]} · ${body}` }]
    ));
    if (messages.length === 0) return [];
    return [{
      id: thread.id, label: t.number.replace("{n}", String(thread.number)),
      quote: `„${thread.anchor.quote}”`, messages, position, start: range.start, number: thread.number,
    }];
  }).sort((a, b) => a.position - b.position || a.start - b.start || a.number - b.number);
}

type ConsultationEntries = ReturnType<typeof consultationEntries>;

export function consultationText(entries: ConsultationEntries): string {
  const threads = entries.map(({ label, quote, messages }) => (
    [label, quote, ...messages.map(({ text }) => text)].join("\n")
  ));
  return [tp.title, ...threads].join("\n\n");
}

/** Print from an isolated frame containing only the same plain text as the clipboard. */
export function printConsultation(frame: HTMLIFrameElement, entries: ConsultationEntries): boolean {
  const page = frame.contentDocument;
  const screen = frame.contentWindow;
  if (!page?.body || typeof screen?.print !== "function") return false;
  const text = page.createElement("div");
  text.style.whiteSpace = "pre-wrap";
  text.style.overflowWrap = "anywhere";
  text.textContent = consultationText(entries);
  page.documentElement.lang = "hr";
  page.title = tp.title;
  page.body.replaceChildren(text);
  const clear = () => text.remove();
  screen.addEventListener("afterprint", clear, { once: true });
  try {
    screen.print();
    return true;
  } catch {
    screen.removeEventListener("afterprint", clear);
    clear();
    return false;
  }
}
