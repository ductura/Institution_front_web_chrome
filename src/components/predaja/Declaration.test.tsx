import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  confirmationKey, DeclarationView, readConfirmed, recordedRows, writeConfirmed,
  type RecordedRead, type RecordedSummary,
} from "./Declaration";

// Invented summary of an invented work (no real student data).
const FULL: RecordedSummary = {
  sessions: { breakAboveMinutes: 30, count: 3 },
  pastes: { listedAboveCharacters: 200, listed: [{}, {}], smallerCount: 4 },
  gaps: { items: [{}] },
  recordState: "has_gaps",
};
const EMPTY: RecordedSummary = {
  sessions: { breakAboveMinutes: 30, count: 0 },
  pastes: { listedAboveCharacters: 200, listed: [], smallerCount: 0 },
  gaps: { items: [] },
  recordState: "complete",
};
const nothing = () => undefined;

function render(recorded: RecordedRead, confirmed = false): string {
  return renderToStaticMarkup(
    <DeclarationView recorded={recorded} confirmed={confirmed}
      onConfirm={nothing} onNext={nothing} onBack={nothing} onRetry={nothing} />,
  );
}

const button = (markup: string, label: string) => markup.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("DeclarationView (WEB-24, S: E-9)", () => {
  it("is step 2 of the submission", () => {
    const current = render({ kind: "ready", summary: FULL }).match(/<li aria-current="step">.*?<\/li>/)?.[0] ?? "";
    expect(text(current).trim()).toBe("2 Izjava");
  });

  it("keeps Dalje disabled and says why until the declaration is confirmed", () => {
    const markup = render({ kind: "ready", summary: FULL });
    expect(button(markup, "Dalje")).toContain("disabled");
    expect(markup).toContain("Potvrdite izjavu da biste nastavili.");
    expect(markup).toMatch(/<input[^>]*type="checkbox"/);
    expect(markup).not.toMatch(/<input[^>]*checked/);
  });

  it("enables Dalje once the declaration is confirmed", () => {
    const markup = render({ kind: "ready", summary: FULL }, true);
    expect(button(markup, "Dalje")).not.toContain("disabled");
    expect(markup).toMatch(/<input[^>]*checked/);
    expect(markup).not.toContain("Potvrdite izjavu da biste nastavili.");
  });

  it("keeps what was recorded and what is declared in separate, labelled blocks", () => {
    const markup = text(render({ kind: "ready", summary: FULL }));
    expect(markup).toContain("Zabilježeno u Ducturi zabilježeno");
    expect(markup).toContain("Vaša izjava izjavljeno");
    expect(markup).toContain("pregledali što je zabilježeno u Ducturi");
  });

  it("puts each number next to its threshold (full)", () => {
    expect(recordedRows(FULL)).toEqual([
      "Broj sesija: 3 (prag: nova sesija počinje nakon stanke dulje od 30 minuta)",
      "Lijepljenja veća od praga: 2 (prag: zasebno se navodi lijepljenje veće od 200 znakova)",
      "Manja lijepljenja, samo broj: 4",
      "Praznine u zapisu: 1",
      "Stanje zapisa: Zapis ima praznine",
    ]);
  });

  it("says nothing is recorded yet (empty)", () => {
    const markup = text(render({ kind: "ready", summary: EMPTY }));
    expect(markup).toContain("U ovom radu još ništa nije zabilježeno.");
    expect(markup).not.toContain("Broj sesija");
  });

  it("shows loading without holding the declaration", () => {
    const markup = render({ kind: "loading" });
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Učitavam zabilježene stavke.");
    expect(button(render({ kind: "loading" }, true), "Dalje")).not.toContain("disabled");
  });

  it("offers a retry on error and still lets the student go on (§5 rule 11)", () => {
    const markup = render({ kind: "error" }, true);
    expect(markup).toContain("Zabilježene stavke trenutačno nije moguće učitati.");
    // Nothing asks the student to confirm a review of what the page could not show.
    expect(markup).not.toContain("pregledali");
    expect(markup).toContain("Potvrdom potvrđujete samo svoju izjavu.");
    expect(button(markup, "Pokušaj ponovno")).not.toBe("");
    expect(button(markup, "Dalje")).not.toContain("disabled");
  });
});

describe("the confirmation lives only in this tab (P-7)", () => {
  const original = (globalThis as { window?: unknown }).window;
  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  function withStorage(): Map<string, string> {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    return store;
  }

  const ASSIGNMENT = "a1b2c3d4-0000-4000-8000-000000000001";

  it("is kept per session and assignment when the student comes back from step 3", () => {
    const store = withStorage();
    const key = confirmationKey("sim-session-a", ASSIGNMENT);
    expect(readConfirmed(key)).toBe(false);
    writeConfirmed(key, true);
    expect(readConfirmed(confirmationKey("sim-session-a", ASSIGNMENT))).toBe(true);
    expect(readConfirmed(confirmationKey("sim-session-a", "a1b2c3d4-0000-4000-8000-000000000002"))).toBe(false);
    writeConfirmed(key, false);
    expect(store.size).toBe(0);
  });

  it("is not found by the next person signed in in the same tab (another session)", () => {
    withStorage();
    writeConfirmed(confirmationKey("sim-session-a", ASSIGNMENT), true);
    expect(readConfirmed(confirmationKey("sim-session-b", ASSIGNMENT))).toBe(false);
  });

  it("keeps nothing without a known session", () => {
    const store = withStorage();
    expect(confirmationKey(null, ASSIGNMENT)).toBeNull();
    writeConfirmed(confirmationKey(null, ASSIGNMENT), true);
    expect(store.size).toBe(0);
    expect(readConfirmed(null)).toBe(false);
  });

  it("reads as not confirmed when storage is refused", () => {
    (globalThis as { window?: unknown }).window = {
      get sessionStorage(): never {
        throw new Error("blocked");
      },
    };
    expect(readConfirmed("k")).toBe(false);
    expect(() => writeConfirmed("k", true)).not.toThrow();
  });
});
