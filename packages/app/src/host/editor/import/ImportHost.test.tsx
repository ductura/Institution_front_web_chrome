import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ImportHost } from "./ImportHost";
import { unavailableTransport } from "../../../../../../src/client/import.ts";

// Server rendering runs no effects: the permission is unread, so there is no button (criterion 1).
describe("ImportHost", () => {
  it("draws no import button before the teacher's permission is known", () => {
    const html = renderToStaticMarkup(<ImportHost assignmentId="11111111-1111-4111-8111-111111111111" transport={unavailableTransport} />);
    expect(html).toBe("");
  });
});
