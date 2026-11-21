import { describe, expect, it } from "vitest";

import { afterConfirm, afterPreview, canConfirm, declare, showImportButton, START } from "./import-model";

// WEB-1801: invented text only.
const preview = { previewId: "22222222-2222-4222-8222-222222222222", format: "docx" as const, paragraphs: ["Izmišljeni odlomak."], words: 2 };
const confirmed = { importedAt: "2026-11-21T10:00:00.000Z", words: 2, source: "file_import" as const };

describe("import button", () => {
  it("shows only on an explicit allowed", () => {
    expect(showImportButton(null)).toBe(false);
    for (const kind of ["notAllowed", "signedOut", "unavailable"] as const) expect(showImportButton({ kind })).toBe(false);
    expect(showImportButton({ kind: "allowed" })).toBe(true);
  });
});

describe("import flow", () => {
  it("shows the preview first and cannot confirm before the declaration", () => {
    const shown = afterPreview({ kind: "preview", preview });
    expect(shown).toMatchObject({ step: "preview", declared: false });
    expect(canConfirm(shown)).toBe(false);
    expect(canConfirm(declare(shown, true))).toBe(true);
    expect(canConfirm(declare(declare(shown, true), false))).toBe(false);
    expect(canConfirm(START)).toBe(false);
  });
  it("maps refusals to the choose step with text", () => {
    expect(afterPreview({ kind: "refused", reason: "type" })).toMatchObject({ step: "choose", error: "Datoteka mora biti DOCX ili PDF." });
    expect(afterPreview({ kind: "notAllowed" })).toMatchObject({ step: "choose" });
  });
  it("finishes with the server event, returns to preview on failure and to choose when expired", () => {
    const busy = { step: "confirming" as const, preview };
    expect(afterConfirm(busy, { kind: "confirmed", confirmed })).toEqual({ step: "done", confirmed });
    expect(afterConfirm(busy, { kind: "unavailable" })).toMatchObject({ step: "preview", declared: true });
    expect(afterConfirm(busy, { kind: "expired" })).toMatchObject({ step: "choose" });
    expect(afterConfirm(START, { kind: "confirmed", confirmed })).toEqual(START);
  });
});
