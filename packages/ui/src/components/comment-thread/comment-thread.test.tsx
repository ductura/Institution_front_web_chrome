import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommentThread, type CommentThreadLabels } from "./CommentThread";
import { replyKeyAction, replyText, visibleEntries, type CommentThreadData } from "./thread-logic";

const labels: CommentThreadLabels = {
  thread: "Komentar uz odlomak", reply: "Odgovor na komentar…", replyField: "Vaš odgovor", send: "Odgovori",
  resolve: "Označi kao riješeno", reopen: "Ponovno otvori", resolved: "Riješeno", open: "Otvoreno",
  showAll: (n) => `Prikaži sve unose (${n})`, collapse: "Sažmi",
};
const thread = (resolved: boolean): CommentThreadData => ({
  id: "t1", anchor: "kućno kompostiranje", resolved,
  entries: [
    { id: "e1", author: "Izmišljena Mentorica", at: "12. 11. 2026.", text: "Navedi izvor.", mentor: true },
    { id: "e2", author: "Izmišljeni Student", at: "13. 11. 2026.", text: "Dodano." },
  ],
});
const noop = () => undefined;
const render = (t: CommentThreadData, readOnly = false) =>
  renderToStaticMarkup(<CommentThread thread={t} labels={labels} onReply={noop} onResolve={noop} onReopen={noop} readOnly={readOnly} />);

describe("comment thread rules (UI-8A)", () => {
  it("sends only non-empty trimmed replies", () => {
    expect(replyText("  ")).toBeNull();
    expect(replyText(" Hvala ")).toBe("Hvala");
  });
  it("Ctrl/Cmd+Enter sends, Escape clears, plain Enter is a new line", () => {
    expect(replyKeyAction("Enter", true, false)).toBe("send");
    expect(replyKeyAction("Enter", false, true)).toBe("send");
    expect(replyKeyAction("Enter", false, false)).toBeNull();
    expect(replyKeyAction("Escape", false, false)).toBe("cancel");
  });
  it("collapses a resolved thread to its first entry", () => {
    expect(visibleEntries(thread(true), false)).toHaveLength(1);
    expect(visibleEntries(thread(true), true)).toHaveLength(2);
    expect(visibleEntries(thread(false), false)).toHaveLength(2);
  });
});

describe("CommentThread markup", () => {
  it("is a named article with a list, a labelled reply field and a resolve button", () => {
    const html = render(thread(false));
    expect(html).toContain('aria-label="Komentar uz odlomak"');
    expect(html).toContain("<ol");
    expect(html).toContain("Vaš odgovor");
    expect(html).toContain("Označi kao riješeno");
    expect(html).toContain("Otvoreno");
  });
  it("a resolved thread offers reopen and expansion, not a reply field", () => {
    const html = render(thread(true));
    expect(html).toContain("Ponovno otvori");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<textarea");
  });
  it("read-only shows no controls", () => {
    const html = render(thread(false), true);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<textarea");
  });
});
