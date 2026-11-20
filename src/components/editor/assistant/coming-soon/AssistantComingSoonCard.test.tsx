import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantComingSoonCard } from "./AssistantComingSoonCard";
import { assistantComingSoonHr } from "./messages.hr";

describe("AssistantComingSoonCard", () => {
  const html = renderToStaticMarkup(<AssistantComingSoonCard />);
  it("shows the soon badge and the pilot text", () => {
    expect(html).toContain("uskoro");
    expect(html).toContain("Asistent u pilotu nije uključen");
    for (const purpose of assistantComingSoonHr.purposes) expect(html).toContain(purpose);
  });
  it("offers no send field and no key entry", () => {
    expect(html).not.toMatch(/<(input|textarea|button|form|select|a)[\s>]/u);
    expect(html).not.toMatch(/unesite ključ|api key|Pitaj asistenta/iu);
  });
  it("makes no request: the module touches no network API", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["AssistantComingSoonCard.tsx", "messages.hr.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\/api\//u);
    }
  });
});
