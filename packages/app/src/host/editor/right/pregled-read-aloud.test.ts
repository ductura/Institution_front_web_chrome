import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { reviewDocOf } from "../../../../../../src/components/editor/review/model";
import { createReadAloud, type ReadAloudState } from "../read-aloud/controller";
import type { ReadAloudHost, SpeechUtteranceLike } from "../read-aloud/support";
import { pregledHr } from "./messages.hr";
import { listenText, WHOLE } from "./pregled-model";

// WEB-V20-NAGLAS-NACRT: the Nacrt view reads through the new core. Invented text only; fake speechSynthesis.
const doc = reviewDocOf([
  { kind: "heading", level: 1, text: "Uvod", id: "h1" },
  { kind: "paragraph", text: "Prva rečenica uvoda. Druga rečenica uvoda." },
  { kind: "heading", level: 1, text: "Metoda", id: "h2" },
  { kind: "paragraph", text: "Rečenica metode." },
]);

function fakeHost() {
  const spoken: (SpeechUtteranceLike & { text: string })[] = [];
  const calls: string[] = [];
  class Utterance {
    lang = ""; rate = 1; voice = null; onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const host: ReadAloudHost = {
    SpeechSynthesisUtterance: Utterance as never,
    speechSynthesis: { speak: (u) => { calls.push("speak"); spoken.push(u as never); }, cancel: () => { calls.push("cancel"); }, pause: () => { calls.push("pause"); }, resume: () => { calls.push("resume"); }, getVoices: () => [] },
  };
  return { host, spoken, calls };
}

describe("Nacrt reads through the new core", () => {
  it("reads exactly the text the view lists for the scope, in order, in hr-HR", () => {
    const { host, spoken } = fakeHost();
    const reader = createReadAloud({}, host);
    expect(reader.start(listenText(doc, WHOLE))).toBe(true);
    expect(spoken[0]!.lang).toBe("hr-HR");
    expect(spoken[0]!.text.startsWith("Uvod")).toBe(true);
    for (let i = 0; i < 10 && spoken[i]; i += 1) spoken[i]!.onend?.();
    const all = spoken.map((u) => u.text).join(" ").replace(/\s+/g, " ");
    expect(all).toBe(listenText(doc, WHOLE).replace(/\s+/g, " "));
  });

  it("a scope change (stop) silences the old reading and a late end of it does nothing", () => {
    const { host, spoken, calls } = fakeHost();
    const states: ReadAloudState[] = [];
    const reader = createReadAloud({ onStateChange: (s) => states.push(s) }, host);
    reader.start(listenText(doc, WHOLE));
    reader.stop();
    expect(calls).toContain("cancel");
    expect(states).toEqual(["reading", "idle"]);
    const before = spoken.length;
    spoken[0]!.onend?.();
    expect(spoken.length).toBe(before);
  });

  it("pauses, resumes and takes a rate; an empty scope reads nothing; unsupported speaks nothing", () => {
    const { host, spoken, calls } = fakeHost();
    const reader = createReadAloud({}, host);
    reader.start(listenText(doc, WHOLE));
    reader.pause();
    expect(reader.state).toBe("paused");
    reader.resume();
    expect(reader.state).toBe("reading");
    expect(calls).toEqual(expect.arrayContaining(["pause", "resume"]));
    reader.setRate(9);
    expect(reader.rate).toBe(1.5);
    expect(createReadAloud({}, host).start(listenText(reviewDocOf([]), WHOLE))).toBe(false);
    const none = createReadAloud({}, {});
    expect(none.state).toBe("unsupported");
    expect(none.start("Izmišljeni tekst.")).toBe(false);
    expect(spoken.length).toBeGreaterThan(0);
  });
});

describe("PregledGroup wiring", () => {
  const source = readFileSync(join(__dirname, "PregledGroup.tsx"), "utf8");
  it("no longer uses the old speech addon and mounts the new controller with pause and rate", () => {
    expect(source).not.toContain("addons/speech");
    expect(source).toContain("createReadAloud(");
    expect(source).toContain("t.listenPause");
    expect(source).toContain("t.listenRate");
    expect(source).toContain("reader.current?.stop()");
  });
  it("keeps the original messages", () => {
    expect(pregledHr.listen).toBe("Poslušaj");
    expect(pregledHr.listenStop).toBe("Stani");
    expect(pregledHr.listenEmpty).toBe("Nema teksta za slušanje u ovom opsegu.");
    expect(pregledHr.listenUnsupported).toBe("Ovaj preglednik ne podržava čitanje naglas.");
    expect(pregledHr.listenLocal).toBe("Čitanje radi u pregledniku; Ductura ne šalje tekst nigdje.");
  });
});
