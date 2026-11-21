import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { announcement, badgeText, NotificationBell, type NotificationBellLabels } from "./index";

const labels: NotificationBellLabels = {
  button: "Obavijesti", buttonWithCount: (n) => `Obavijesti, nepročitanih: ${n}`, panel: "Popis obavijesti",
  empty: "Nema obavijesti.", unavailable: "Obavijesti nisu dostupne.", unreadMark: "Novo", changed: (n) => `Nepročitanih obavijesti: ${n}`,
};
const entry = (id: string, read: boolean) => ({ id, text: "Novi komentar na radu", when: "3. 11. 2026.", read, href: `/rad/${id}` });

describe("badgeText", () => {
  it.each([[0, ""], [-1, ""], [Number.NaN, ""], [3, "3"], [99, "99"], [100, "99+"]])("%s -> %j", (n, text) => expect(badgeText(n)).toBe(text));
});

describe("announcement", () => {
  it("is silent on first render and when nothing changed", () => {
    expect(announcement(null, 2, labels.changed)).toBe("");
    expect(announcement(2, 2, labels.changed)).toBe("");
  });
  it("says the new count when it changes", () => expect(announcement(2, 3, labels.changed)).toBe("Nepročitanih obavijesti: 3"));
});

describe("NotificationBell", () => {
  const html = (props: Partial<Parameters<typeof NotificationBell>[0]>) =>
    renderToStaticMarkup(<NotificationBell entries={[]} unread={0} status="ready" labels={labels} onOpenEntry={() => {}} {...props} />);

  it("names the button with the count and keeps a polite live region", () => {
    const out = html({ unread: 2, entries: [entry("a", false)] });
    expect(out).toContain('aria-label="Obavijesti, nepročitanih: 2"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('aria-expanded="false"');
  });
  it("uses the plain name without unread ones", () => expect(html({})).toContain('aria-label="Obavijesti"'));
  it("lists entries as links, marking unread ones with a word", () => {
    const out = html({ unread: 1, defaultOpen: true, entries: [entry("a", false), entry("b", true)] });
    expect(out).toContain('href="/rad/a"');
    expect(out.match(/Novo/g)).toHaveLength(1);
  });
  it("says so when empty or unavailable", () => {
    expect(html({ defaultOpen: true })).toContain("Nema obavijesti.");
    expect(html({ defaultOpen: true, status: "unavailable" })).toContain("Obavijesti nisu dostupne.");
  });
});
