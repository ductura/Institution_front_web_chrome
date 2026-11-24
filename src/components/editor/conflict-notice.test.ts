// ED-08 (NF2-P3): the conflict notice promises no choice the server cannot make yet (INVENTAR §5.1); it says what
// the student can do now: export the text and contact support.
import { describe, expect, it } from "vitest";

import { messagesEn } from "@/lib/i18n/messages.en";
import { messagesHr } from "@/lib/i18n/messages.hr";

describe("ED-08 conflict notice", () => {
  const hr = messagesHr.editor.evidenceConflict;

  it("promises no decision", () => {
    expect(hr).not.toMatch(/odluč|odaber|izbor|odluk/i);
    expect(messagesEn.editor.evidenceConflict).not.toMatch(/decide|choose|choice/i);
  });

  it("says the text stays here and what to do now", () => {
    expect(hr).toContain("Tekst ostaje na uređaju");
    expect(hr).toContain("Izvezite tekst");
    expect(hr).toContain("javite se podršci");
  });

  it("never says the server holds the text", () => {
    expect(hr).not.toMatch(/spremljeno na poslužitelju|sinkronizirano/i);
  });
});
