import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantAsking } from "./AssistantAsking";
import { AssistantEntitlementUnconfirmed } from "./AssistantEntitlementUnconfirmed";
import { AssistantOffline } from "./AssistantOffline";
import { AssistantProviderError } from "./AssistantProviderError";
import { AssistantUnavailable } from "./AssistantUnavailable";

const nothing = () => undefined;
const common = { title: "Pomoćnik", busy: "Provjeravam…", disabled: "Isključeno na ovom zadatku." };

describe("assistant panel states markup", () => {
  it("a provider failure is an alert with a retry and a quiet close", () => {
    const html = renderToStaticMarkup(<AssistantProviderError onRetry={nothing} onClose={nothing}
      labels={{ ...common, message: "Ne odgovara.", retry: "Pokušaj ponovno", close: "Zatvori" }} />);
    expect(html).toContain('data-assistant-state="provider-error"');
    expect(html).toMatch(/role="alert"[^>]*>Ne odgovara\./u);
    expect(html).toContain(">Pokušaj ponovno</button>");
    expect(html).toMatch(/data-tone="quiet"[^>]*>Zatvori/u);
    expect(html).not.toContain("aria-disabled");
  });

  it("calm notices are status text and offer no action", () => {
    const html = renderToStaticMarkup(<AssistantUnavailable labels={{ ...common, message: "Nije dostupan." }} />);
    expect(html).toMatch(/role="status"[^>]*>Nije dostupan\./u);
    expect(html).not.toContain("<button");
  });

  it("offline shows its tag", () => {
    const html = renderToStaticMarkup(<AssistantOffline labels={{ ...common, tag: "Bez mreže", message: "Čita se s uređaja." }} />);
    expect(html).toContain("Bez mreže");
    expect(html).toContain('data-assistant-state="offline"');
  });

  it("busy keeps actions in the tab order but inert, and announces the busy text", () => {
    const html = renderToStaticMarkup(<AssistantAsking busy onAnswer={nothing}
      labels={{ ...common, message: "Pomoćnik pita.", answer: "Odgovori" }} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/role="status"[^>]*>Provjeravam…/u);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Odgovori/u);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/u);
  });

  it("disabled says why, next to every action", () => {
    const html = renderToStaticMarkup(<AssistantEntitlementUnconfirmed disabled onClose={nothing}
      labels={{ ...common, message: "Nije dopušteno.", close: "Zatvori" }} />);
    const id = /<p[^>]*id="([^"]+)"[^>]*>Isključeno na ovom zadatku\./u.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-describedby="${id}"`);
  });

  it("an action error and slot content both render", () => {
    const html = renderToStaticMarkup(<AssistantOffline error="Provjera nije uspjela."
      labels={{ ...common, message: "Bez mreže." }}><p>Raniji odgovor</p></AssistantOffline>);
    expect(html).toMatch(/role="alert"[^>]*>Provjera nije uspjela\./u);
    expect(html).toContain("<p>Raniji odgovor</p>");
  });
});
