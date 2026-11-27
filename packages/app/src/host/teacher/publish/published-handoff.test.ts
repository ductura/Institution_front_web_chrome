// F4-NAS-R13 (NAS-19): the mark of a confirmed publish is read once and carries no text.
import { describe, expect, it } from "vitest";

import { handOverPublished, takePublished, type HandoffStore } from "./published-handoff";

function memory(): HandoffStore & { size: () => number } {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
    size: () => data.size,
  };
}

describe("published handoff (NAS-19)", () => {
  it("is taken once after a hand-over, then the mark is gone", () => {
    const store = memory();
    expect(takePublished(store)).toBe(false);
    expect(handOverPublished(store)).toBe(true);
    expect(takePublished(store)).toBe(true);
    expect(takePublished(store)).toBe(false);
    expect(store.size()).toBe(0);
  });

  it("says false without storage or when the browser refuses it", () => {
    expect(handOverPublished(null)).toBe(false);
    expect(takePublished(null)).toBe(false);
    const refusing: HandoffStore = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(handOverPublished(refusing)).toBe(false);
    expect(takePublished(refusing)).toBe(false);
  });

  it("ignores a foreign value under the key", () => {
    const store = memory();
    store.setItem("ductura.nastavnik.objava-zadatka", "<b>tekst</b>");
    expect(takePublished(store)).toBe(false);
  });
});
