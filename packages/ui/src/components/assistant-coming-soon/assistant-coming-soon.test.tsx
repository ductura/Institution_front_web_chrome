import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantComingSoon, type AssistantComingSoonLabels } from "./AssistantComingSoon";

const labels: AssistantComingSoonLabels = {
  title: "Asistent", badge: "uskoro", body: "Asistent u pilotu nije uključen.",
  purposesTitle: "Svrha korištenja", purposesList: "Planirane svrhe",
};

describe("AssistantComingSoon markup", () => {
  const html = renderToStaticMarkup(<AssistantComingSoon labels={labels} purposes={["Lektura", "Prijevod"]} />);
  it("shows the card with an understandable badge and the purposes as text", () => {
    expect(html).toContain('data-assistant-state="coming-soon"');
    expect(html).toContain("uskoro");
    expect(html).toContain("Asistent u pilotu nije uključen.");
    expect(html).toContain('aria-label="Planirane svrhe"');
    expect(html).toContain("Lektura");
  });
  it("has no field, button, form, key input or link", () => {
    expect(html).not.toMatch(/<(input|textarea|button|form|select|a)[\s>]/u);
  });
});
