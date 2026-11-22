import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import N11Compare from "./Compare";
import { fakeN11Port } from "./fake-port";

// No DOM library in this package: the static render covers the first paint (title and loading state);
// every state after the reads is decided by model.ts, which model.test.ts covers.
describe("N-11 compare screen", () => {
  it("paints the title and the loading text first", () => {
    const html = renderToStaticMarkup(createElement(N11Compare, { port: fakeN11Port(), documentId: "d", replayHref: "/r", signInHref: "/s" }));
    expect(html).toContain('<h1 id="pg-h">Usporedba verzija</h1>');
    expect(html).toContain("Učitavam poslane verzije…");
  });
});
