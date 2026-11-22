import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MentorCard } from "./MentorCard";

const base = { now: new Date("2026-11-22T10:00:00"), seenAt: null, words: null } as const;
const NOT_GIVEN = { state: null, milestones: null, messages: null, slots: null, howText: null, prep: null } as const;

describe("MentorCard", () => {
  it("says nedostupno for what the server does not give, and draws no action", () => {
    const html = renderToStaticMarkup(createElement(MentorCard, { ...base, ...NOT_GIVEN, role: "student" }));
    expect(html).toContain("Stanje rada trenutačno nije dostupno.");
    expect(html).toContain("Ovaj podatak trenutačno nije dostupan.");
    expect(html).toContain("Priprema trenutačno nije dostupna.");
    expect(html).toContain("nije napisan");
    expect(html).not.toContain("<button");
  });

  it("draws the state, the badge and only the actions the caller wired", () => {
    const props = { ...base, ...NOT_GIVEN, state: { kind: "draft" } as const, messages: [], slots: [], role: "student" as const };
    expect(renderToStaticMarkup(createElement(MentorCard, props))).not.toContain("Pošalji mentoru na pregled");
    const wired = renderToStaticMarkup(createElement(MentorCard, { ...props, onAction: () => undefined }));
    expect(wired).toContain("Rad je kod Vas");
    expect(wired).toContain("Pošalji mentoru na pregled");
    expect(renderToStaticMarkup(createElement(MentorCard, { ...props, role: "collaborator", onAction: () => undefined }))).not.toContain("<button");
  });

  it("leaves requests to the shared client", () => {
    const files = readdirSync(import.meta.dirname).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n));
    for (const file of files) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(code, file).not.toMatch(/\b(?:fetch|browserTransport|createApi|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d/);
    }
  });
});
