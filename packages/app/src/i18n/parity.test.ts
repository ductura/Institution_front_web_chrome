import { describe, expect, it } from "vitest";

import { keyGaps, uiMessagesEn, uiMessagesHr } from "@ductura/ui";

import { messagesEn as interfaceEn } from "../../../../locales/en.ts";
import { messagesHr as interfaceHr } from "../../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";
import { messagesEn as workEn } from "../../../../src/lib/i18n/messages.en.ts";
import { messagesHr as workHr } from "../../../../src/lib/i18n/messages.hr.ts";

import { consultationMessages } from "../../../../src/components/teacher/consultation-records/messages.hr.ts";

import { appMessagesEn, appMessagesHr, cataloguesFor } from "./catalogue";

const none = { missing: [], extra: [], placeholders: [] };

function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node !== null && typeof node === "object") return Object.values(node).flatMap(texts);
  return [];
}

// M11.5 criterion 1 (D-70): every table of the interface has every key of the
// Croatian one in English, with the same placeholders, and nothing more. A
// key missing in English is text that would show untranslated.
describe("English has every Croatian key", () => {
  it.each([
    ["the interface catalogue (locales/)", interfaceHr, interfaceEn],
    ["the work catalogue (src/lib/i18n)", workHr, workEn],
    ["the UI package", uiMessagesHr, uiMessagesEn],
    ["the app's own screens", appMessagesHr, appMessagesEn],
  ])("%s", (_, hr, en) => {
    expect(keyGaps(hr, en)).toEqual(none);
  });
});

describe("the app's own texts", () => {
  it("hold no empty text and no forbidden term in either language (Ductus PRODUCT §5)", () => {
    for (const [lang, table] of [["hr", appMessagesHr], ["en", appMessagesEn]] as const) {
      for (const text of texts(table)) {
        expect(text.trim(), text).not.toBe("");
        expect(findForbiddenTerms(text, lang), text).toEqual([]);
      }
    }
  });

  it("are not left in Croatian in the English table", () => {
    const hr = new Set(texts(appMessagesHr));
    // The language names are each written in their own language, in both tables; "Student" is the same word in both.
    const same = texts(appMessagesEn).filter((text) => hr.has(text) && !["Hrvatski", "English", "Student"].includes(text));
    expect(same).toEqual([]);
  });

  it("name a page exactly as its screen does in Croatian", () => {
    expect(appMessagesHr.pages.consultations).toBe(consultationMessages.title);
  });

  it("give one language's tables together", () => {
    const en = cataloguesFor("en");
    expect(en.t.shell.signOut).toBe(interfaceEn.shell.signOut);
    expect(en.work).toBe(workEn);
    expect(en.ui.diff.added).toBe("Added");
    expect(en.app.profile.title).toBe("Profile settings");
    expect(cataloguesFor("hr").app.profile.title).toBe("Postavke profila");
  });
});
