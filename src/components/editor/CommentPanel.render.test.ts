import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { messagesHr } from "@/lib/i18n/messages.hr";

import CommentPanel from "./CommentPanel";

/**
 * The student's comment panel (WEB-8B): a derived view of separate records,
 * never a mark in the document. Before the list arrives it shows only the
 * loading line and the note that comments stay outside the text. Synthetic
 * texts only.
 */

vi.mock("./LocalDocument", () => ({
  useLocalEditor: () => null,
  useLocalSignedOut: () => false,
  useLocalSubmitted: () => false,
}));

const t = messagesHr.comments;

describe("CommentPanel", () => {
  const html = renderToStaticMarkup(createElement(CommentPanel, { documentId: "aaaaaaaa-0000-4000-8000-000000000001" }));

  it("shows the loading line, the title and the note about the separate record", () => {
    expect(html).toContain(t.title);
    expect(html).toContain(t.loading);
    expect(html).toContain(t.note);
  });

  it("offers no way to open a comment on a passage, only to reply", () => {
    expect(html).not.toContain("Novi komentar");
  });
});
