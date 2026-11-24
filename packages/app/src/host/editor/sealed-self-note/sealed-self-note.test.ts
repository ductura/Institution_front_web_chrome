// WEB-NF6-SIFRA: the text rules, no request outside the shared client, and a first render.
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sealedSelfNoteHr } from "./messages";
import { SealedSelfNote } from "./SealedSelfNote";
import type { SelfNotePort } from "./self-note-model";

const texts = Object.values(sealedSelfNoteHr).map((v) => (typeof v === "function" ? v(3) : v));

describe("the interface text", () => {
  it("never names a password and uses no technical terms", () => {
    for (const text of texts) {
      expect(text, text).not.toMatch(/lozink|šifr|kriptir|enkript|ključ za|AES|PBKDF|IndexedDB|base32|UUID|token/i);
    }
  });

  it("says plainly that nobody can bring back a lost phrase and code", () => {
    expect(sealedSelfNoteHr.warning).toContain("Nitko ih ne može vratiti");
    expect(sealedSelfNoteHr.warning).toContain("ni fakultet");
    expect(sealedSelfNoteHr.resetBody).toContain("ne može poništiti");
  });
});

it("leaves sealed self-note requests to the shared client", () => {
  const files = readdirSync(import.meta.dirname).filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"));
  expect(files).toEqual(expect.arrayContaining(["SealedSelfNote.tsx", "self-note-model.ts", "messages.ts"]));
  for (const file of files) {
    const code = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(code, file).not.toMatch(/\b(?:fetch|browserTransport|createApi|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios|localStorage|sessionStorage)\b|\/api\/v\d|\bformAction\b|work\.self-note\./);
  }
});

it("renders the title and the loading state first", () => {
  const never = new Promise<never>(() => {});
  const port = new Proxy({}, { get: () => () => never }) as SelfNotePort;
  const html = renderToStaticMarkup(createElement(SealedSelfNote, { documentId: "rad-izmisljeni-1", port }));
  expect(html).toContain(sealedSelfNoteHr.title);
  expect(html).toContain(sealedSelfNoteHr.loading);
});
