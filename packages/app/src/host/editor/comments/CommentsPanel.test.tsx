import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommentsPanel } from "./CommentsPanel";

// Server rendering runs no effects: the first paint is the loading state, with no write control.
describe("CommentsPanel", () => {
  it("starts in the loading state", () => {
    const html = renderToStaticMarkup(<CommentsPanel workId="w1" role="student" port={null} selection={() => null} docSize={() => 0} onJump={() => {}} />);
    expect(html).toContain("Učitavanje komentara…");
    expect(html).not.toContain("<button");
  });
});
