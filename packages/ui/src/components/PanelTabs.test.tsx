import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PanelTabs } from "./PanelTabs";

// ED-38 (P2-7): the count beside a tab's name, as the prototype's `.cnt`.
describe("PanelTabs count", () => {
  const html = (value: number) => renderToStaticMarkup(<PanelTabs label="Kartice" tabs={[
    { id: "a", label: "Izvori", content: "x" },
    { id: "b", label: "Komentari", content: "y", count: { value, label: `${value} otvorena komentara` } },
  ]} />);

  it("shows the digit to the eye and the whole phrase to a screen reader", () => {
    const out = html(3);
    expect(out).toContain('<span class="panel-tabs__count" aria-hidden="true">3</span>');
    expect(out).toContain('<span class="visually-hidden">(3 otvorena komentara)</span>');
  });

  it("shows nothing at zero, never a 0 badge", () => {
    const out = html(0);
    expect(out).not.toContain("panel-tabs__count");
    expect(out).not.toContain("otvorena komentara");
  });
});
