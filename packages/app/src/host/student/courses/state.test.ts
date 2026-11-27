// DIZ S-02/S-04 (Z4, Z7, R6, R8): the shared state of the courses and works pages.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../../../../locales/hr.ts";
import { State } from "./CoursesPages";
import { coursesText } from "./messages.hr";

const draw = (kind: "denied" | "unavailable" | "signedOut", signedOut?: string) =>
  renderToStaticMarkup(createElement(State, { read: { kind }, retry: () => undefined, here: "/zadaci/radovi", base: "", signedOut }));

describe("State", () => {
  it("403 is the heading and the way back to one's own space, with no alert and no retry", () => {
    const html = draw("denied");
    expect(html).toContain(messagesHr.access.deniedTitle);
    expect(html).toContain(`<a href="/zadaci">${messagesHr.access.backToOwn}</a>`);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(coursesText.retry);
  });

  it("unavailable is one alert frame with 'Pokušaj ponovno' under it as a link-styled control, no outlined button", () => {
    const html = draw("unavailable");
    expect(html).toMatch(/<div role="alert"/);
    expect(html).toContain(coursesText.retry);
    expect(html).not.toMatch(/class="[^"]*btn/);
  });

  it("signed out says the wording the page gives (works: its own draft text)", () => {
    expect(draw("signedOut", coursesText.signedOutWorks)).toContain("Prijavite se da vidite svoje radove.");
    expect(draw("signedOut")).toContain(coursesText.signedOut);
  });
});
