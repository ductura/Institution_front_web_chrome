// @vitest-environment jsdom
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormatCheckView, readFormatCheck } from "./FormatCheck";
import { formatCheckText as t } from "./messages.hr";
import type { StepWork } from "../../student/submission/summary/model";

const BODY = { wordMin: 3, wordMax: null, minSources: 0, requiredSections: ["Uvod"], citationStyle: "fpzg", font: null, size: null, spacing: null };
const rules = async () => ({ ok: true as const, body: BODY });
const ready = (text: string): StepWork => ({ kind: "ready", documentId: "d-1", nodes: [{ type: "paragraph", children: [{ text, marks: [] }] }] });
const view = (read: Parameters<typeof FormatCheckView>[0]["read"]) => renderToStaticMarkup(h(FormatCheckView, { read, onRetry: () => undefined }));

describe("readFormatCheck", () => {
  it("checks the server's text against the rules, advisory only", async () => {
    const read = await readFormatCheck("a-1", async () => ready("jedan dva"), rules);
    expect(read.kind).toBe("ready");
    const html = view(read);
    expect(html).toContain("Broj riječi: odstupa");
    expect(html).toContain("Uvod");
    expect(html).toContain(t.advisory);
  });
  it("keeps loading, failure, no text and no rules apart", async () => {
    expect((await readFormatCheck("a-1", async () => ({ kind: "empty" }), rules)).kind).toBe("noText");
    expect((await readFormatCheck("a-1", async () => ({ kind: "unavailable" }), rules)).kind).toBe("unavailable");
    expect((await readFormatCheck("tuđe", async () => ready("x"), async () => ({ ok: false, status: 404 }))).kind).toBe("unavailable");
    expect(view({ kind: "loading" })).toContain(t.loading);
    expect(view({ kind: "unavailable" })).toContain(t.retry);
    expect(view({ kind: "noText" })).toContain(t.noText);
    const none = { ...BODY, wordMin: null, requiredSections: [] };
    const read = await readFormatCheck("a-1", async () => ready("x"), async () => ({ ok: true, body: none }));
    expect(view(read)).toContain("nedostupno");
    expect(view(read)).not.toContain(": odstupa.");
    expect(view(read)).toContain(t.allOk);
  });
});
