import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import { EditorNotices } from "./EditorNotices";
import { editorNoticesHr } from "./notices.hr";

describe("editor notices", () => {
  it("keeps the live region mounted and states only the known save status", () => {
    expect(renderToStaticMarkup(<EditorNotices notices={[]} />)).toBe('<div role="status"></div>');
    const offline = renderToStaticMarkup(<EditorNotices notices={[{ kind: "offline", savingLocally: false, resumesSync: true }]} />);
    expect(offline).toContain("Bez mreže.");
    expect(offline).not.toContain("sprema");
    expect(offline).not.toContain("poslužitelj");
    const saving = renderToStaticMarkup(<EditorNotices notices={[{ kind: "offline", savingLocally: true, resumesSync: true }]} />);
    expect(saving).toContain("sprema na ovom uređaju");
    expect(saving).toContain(editorNoticesHr.resumeSync);
  });

  it("shows the real chapter title as text and offers the corresponding action", () => {
    const html = renderToStaticMarkup(<EditorNotices notices={[{ kind: "chapter", title: "Izmišljeno <poglavlje> $&", showAll() {} }]} />);
    expect(html).toContain("„Izmišljeno &lt;poglavlje&gt; $&amp;”.");
    expect(html).toContain("Prikaži cijeli rad</button>");
    expect(findForbiddenTerms(JSON.stringify(editorNoticesHr), "hr")).toEqual([]);
  });
});
