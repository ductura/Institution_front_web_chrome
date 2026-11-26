// F4-EDI-R05: the pure parts of the conflict decision. The dialog is JSX, which the unit project does not
// render; it is checked to be mounted from the sheet and to run only the two choices of the task.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { messagesEn } from "@/lib/i18n/messages.en";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { conflictParts, documentText } from "./conflict-resolution";

const source = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

describe("documentText", () => {
  it("joins the text of each block, blocks apart by a blank line", () => {
    const doc = { schemaVersion: 1, nodes: [
      { id: "a", type: "paragraph", children: [{ text: "Prvi " }, { text: "odlomak" }] },
      { id: "b", type: "paragraph", children: [{ text: "Drugi" }] },
    ] };
    expect(documentText(doc as never)).toBe("Prvi odlomak\n\nDrugi");
  });
  it("shows a citation's source and locator and the source records, so a difference in them is seen", () => {
    const doc = (locator: string, title: string) => ({ schemaVersion: 3, nodes: [
      { id: "a", type: "paragraph", children: [{ text: "Tvrdnja " }, { type: "citation", sourceId: "s1", locator }] },
    ], sources: [{ id: "s1", title }] });
    const a = documentText(doc("str. 4", "Izmišljena knjiga") as never);
    expect(a).toContain("[s1, str. 4]");
    expect(a).toContain("Izmišljena knjiga");
    expect(documentText(doc("str. 9", "Izmišljena knjiga") as never)).not.toBe(a);
    expect(documentText(doc("str. 4", "Druga knjiga") as never)).not.toBe(a);
  });
  it("is empty for a document with no blocks", () => {
    expect(documentText({ schemaVersion: 1, nodes: [] } as never)).toBe("");
  });
});

describe("conflictParts", () => {
  const sayOf = (kind: string, parts: ReturnType<typeof conflictParts>) =>
    parts.filter((part) => part.kind === kind).map((part) => part.text.trim());

  it("marks what only the server has as added and what only this device has as removed", () => {
    const parts = conflictParts("Moj izmišljeni uvod", "Uvod s drugog uređaja");
    expect(sayOf("removed", parts)).toEqual(["Moj", "izmišljeni", "uvod"]);
    expect(sayOf("added", parts)).toEqual(["Uvod", "s", "drugog", "uređaja"]);
    expect(sayOf("same", parts)).toEqual([]);
    const shared = conflictParts("Moj uvod ostaje", "Njihov uvod ostaje");
    expect(sayOf("same", shared)).toEqual(["uvod", "ostaje"]);
  });

  it("changes nothing for equal texts, and the parts read back as the server's text", () => {
    expect(conflictParts("isti tekst", "isti tekst").every((part) => part.kind === "same")).toBe(true);
    const parts = conflictParts("a b c d", "a x c y d");
    expect(parts.filter((part) => part.kind !== "removed").map((part) => part.text).join("")).toBe("a x c y d");
    expect(parts.filter((part) => part.kind !== "added").map((part) => part.text).join("")).toBe("a b c d");
  });

  it("shows a middle too large for a word table whole, still readable both ways", () => {
    const a = Array.from({ length: 2500 }, (_, i) => `a${i}`).join(" ");
    const b = Array.from({ length: 2500 }, (_, i) => `b${i}`).join(" ");
    const parts = conflictParts(`start ${a} end`, `start ${b} end`);
    expect(parts.filter((part) => part.kind !== "removed").map((part) => part.text).join("")).toBe(`start ${b} end`);
    expect(parts.filter((part) => part.kind !== "added").map((part) => part.text).join("")).toBe(`start ${a} end`);
  });
});

describe("the dialog's two choices", () => {
  it("offers exactly the owner's two choices, in both languages", () => {
    const hr = messagesHr.editor.conflictDialog;
    expect(hr.takeServer).toBe("Uzmi verziju s poslužitelja");
    expect(hr.keepLocal).toBe("Zadrži tekst s ovog uređaja");
    expect(messagesEn.editor.conflictDialog.takeServer).toBeTruthy();
    expect(messagesEn.editor.conflictDialog.keepLocal).toBeTruthy();
  });

  it("is mounted from the sheet only while the notice says conflict, and sends through the session", () => {
    const sheet = source("LocalDocument.tsx");
    expect(sheet).toContain("{value.conflict && notice === \"conflict\" ? <ConflictDialog offer={value.conflict} /> : null}");
    // Both choices take the server's version first; "mine" types the kept text in as an ordinary change.
    expect(sheet).toContain("evidence.adoptServer(true)");
    expect(sheet).toContain("applyKeptDocument(editor, keep, sheet)");
    // A sticky load holds the lock and the session (review c.4712144263), or the dialog could read nothing.
    expect(sheet).toMatch(/if \(sticky\) \{\s+await new Promise<void>\(\(resolve\) => \{\s+release = resolve;/);
    const dialog = source("ConflictDialog.tsx");
    expect(dialog).toContain('choose("server")');
    expect(dialog).toContain('choose("mine")');
    // No request of its own: the new commit goes out through the evidence session and its drain.
    expect(dialog).not.toMatch(/fetch\(|callMigrationRoute|\/api\//);
  });
});
