import { describe, expect, it } from "vitest";

import { reviewDocOf } from "../../../../../../src/components/editor/review/model";
import { writingSessionHr as t } from "./messages.hr";
import {
  appendLog, loadLog, loadSession, MAX_LOG, minutesOf, parseSession, recentSessions, saveSession, sessionKey, startSession,
  summarize, topChapters, totalWords, type SessionStorage,
} from "./session-model";

// ED-77: invented text and scopes only.
const SCOPE_A = "a".repeat(64);
const SCOPE_B = "b".repeat(64);
const WORK = "rad-zamisljeni-1";
const T0 = Date.UTC(2026, 10, 27, 9, 0);

const docOf = (intro: string, method: string) => reviewDocOf([
  { kind: "heading", level: 1, text: "Uvod", id: "h1" },
  { kind: "paragraph", text: intro },
  { kind: "heading", level: 2, text: "Pozadina", id: "h1a" },
  { kind: "paragraph", text: "Dvije riječi." },
  { kind: "heading", level: 1, text: "Metoda", id: "h2" },
  { kind: "paragraph", text: method },
]);

function memory(): SessionStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}

describe("writing session", () => {
  it("counts the work's words and the words of each top chapter with its subchapters", () => {
    const doc = docOf("Prva rečenica uvoda.", "Metoda ima četiri riječi.");
    expect(totalWords(doc)).toBe(1 + 3 + 1 + 2 + 1 + 4);
    expect(topChapters(doc)).toEqual([
      { key: "h1", title: "1 Uvod", words: 3 + 1 + 2 },
      { key: "h2", title: "2 Metoda", words: 4 },
    ]);
  });

  it("sums up words and minutes against the start and lists only the chapters that changed", () => {
    const before = docOf("Prva rečenica uvoda.", "Metoda ima četiri riječi.");
    const session = startSession(before, { words: 150, minutes: 25 }, T0);
    const after = docOf("Prva rečenica uvoda.", "Metoda sada ima pet riječi i još tri.");
    const at = T0 + 31 * 60_000;
    expect(minutesOf(session, at)).toBe(31);
    expect(summarize(session, after, at)).toEqual({ words: 4, minutes: 31, goalWords: 150, chapters: [{ title: "2 Metoda", delta: 4 }] });
    expect(minutesOf(session, T0 - 60_000)).toBe(0);
  });

  it("keeps the open session and the log per person and per work", () => {
    const storage = memory();
    const session = startSession(docOf("Uvod.", "Metoda."), { words: 300, minutes: 0 }, T0);
    saveSession(storage, SCOPE_A, WORK, session);
    expect(loadSession(storage, SCOPE_A, WORK)).toEqual(session);
    expect(loadSession(storage, SCOPE_B, WORK)).toBeNull();
    expect(loadSession(storage, SCOPE_A, "drugi-rad")).toBeNull();
    expect([...storage.data.keys()]).toEqual([sessionKey(SCOPE_A, WORK)]);
    saveSession(storage, SCOPE_A, WORK, null);
    expect(loadSession(storage, SCOPE_A, WORK)).toBeNull();

    for (let i = 0; i < MAX_LOG + 3; i += 1) appendLog(storage, SCOPE_A, WORK, { endedAt: T0 + i, words: i - 2, minutes: i });
    const log = loadLog(storage, SCOPE_A, WORK);
    expect(log).toHaveLength(MAX_LOG);
    expect(recentSessions(log).map((s) => s.minutes)).toEqual([22, 21, 20, 19, 18]);
    expect(loadLog(storage, SCOPE_B, WORK)).toEqual([]);
  });

  it("ignores a broken or foreign stored value and survives a storage that throws", () => {
    expect(parseSession("{")).toBeNull();
    expect(parseSession(JSON.stringify({ startedAt: -1, goalWords: 0, goalMinutes: 0, startWords: 0, startChapters: {} }))).toBeNull();
    const throwing: SessionStorage = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(loadSession(throwing, SCOPE_A, WORK)).toBeNull();
    expect(() => saveSession(throwing, SCOPE_A, WORK, null)).not.toThrow();
    expect(appendLog(throwing, SCOPE_A, WORK, { endedAt: T0, words: 1, minutes: 1 })).toHaveLength(1);
  });

  it("writes the prototype's texts without a middle dot", () => {
    expect(t.running(120, 300, 12, 45)).toBe("+120 / 300 riječi, 12 / 45 min");
    expect(t.running(-3, 0, 5, 0)).toBe("−3 riječi, 5 min");
    expect(t.doneLead(1, 3)).toBe("Napisano 1 riječ u 3 min.");
    expect(t.doneLead(-12345, 40)).toBe("Skraćeno za 12 345 riječi u 40 min.");
    expect(t.goalLeft(20)).toBe("Do cilja je ostalo 20 riječi.");
    expect(t.wordGoal(0)).toBe("bez cilja");
    expect(t.minuteGoal(90)).toBe("90 min");
    const texts: unknown[] = Object.values(t);
    expect(texts.some((v) => typeof v === "string" && v.includes("·"))).toBe(false);
    expect(t.previousRow(5, 7)).not.toContain("·");
  });
});
