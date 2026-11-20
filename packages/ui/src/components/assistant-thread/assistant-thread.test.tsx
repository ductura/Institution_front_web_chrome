import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantThread, type AssistantThreadLabels } from "./AssistantThread";

const labels: AssistantThreadLabels = {
  conversation: "Razgovor", user: "Vi", assistant: "Pomoćnik", empty: "Nema poruka.",
  prompt: "Vaše pitanje", send: "Pošalji", waiting: "Pomoćnik odgovara…", disabled: "Nedostupno.",
  warning: {
    title: "Moguće osobne podatke", description: "Provjerite prije slanja.",
    kinds: { email: "adresa e-pošte", longNumber: "dugi broj", phone: "telefon" },
    removeAndSend: "Ukloni i pošalji", sendAnyway: "Pošalji svejedno", cancel: "Odustani",
  },
};
const noop = () => undefined;
const base = { labels, draft: "", onDraftChange: noop, onSend: noop };

describe("AssistantThread markup", () => {
  it("shows the empty note without a list", () => {
    const html = renderToStaticMarkup(<AssistantThread {...base} messages={[]} />);
    expect(html).toContain("Nema poruka.");
    expect(html).not.toContain("<ol");
  });
  it("labels user and assistant messages", () => {
    const html = renderToStaticMarkup(<AssistantThread {...base}
      messages={[{ id: "1", role: "user", text: "Probno pitanje" }, { id: "2", role: "assistant", text: "Probni odgovor" }]} />);
    expect(html).toContain('data-role="user"');
    expect(html).toContain('data-role="assistant"');
    expect(html).toContain("Probni odgovor");
  });
  it("announces waiting and offers no send while waiting", () => {
    const html = renderToStaticMarkup(<AssistantThread {...base} draft="Pitanje" waiting messages={[]} />);
    expect(html).toContain("Pomoćnik odgovara…");
  });
  it("shows the personal data warning with the three choices", () => {
    const html = renderToStaticMarkup(<AssistantThread {...base} draft="x" messages={[]}
      privacyWarning={{ kinds: ["email"], onRemoveAndSend: noop, onSendAnyway: noop, onCancel: noop }} />);
    expect(html).toContain("adresa e-pošte");
    expect(html).toContain("Ukloni i pošalji");
    expect(html).toContain("Pošalji svejedno");
    expect(html).toContain("Odustani");
    expect(html).not.toContain('type="submit"');
  });
  it("shows the disabled note and an error alert", () => {
    const html = renderToStaticMarkup(<AssistantThread {...base} disabled error="Greška." messages={[]} />);
    expect(html).toContain("Nedostupno.");
    expect(html).toContain('role="alert"');
  });
});
