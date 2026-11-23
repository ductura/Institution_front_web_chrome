import { describe, expect, it, vi } from "vitest";

import { submitText as t } from "./messages.hr";
import { fill } from "./model";
import { submitConfirmed, waitForLatest, type Confirmed, type NewerChoice, type NewerLocalDeps } from "./newer-local";

// Invented data: one document, the server confirmed V7, the device holds a newer version.
const V7: Confirmed = { documentId: "doc-int16-test", revision: 7 };
const V8: Confirmed = { documentId: "doc-int16-test", revision: 8 };

function deps(over: Partial<NewerLocalDeps<string>> & { answers?: (NewerChoice | null)[] } = {}) {
  const answers = [...(over.answers ?? [])];
  return {
    hasNewer: vi.fn(over.hasNewer ?? (async () => true)),
    ask: vi.fn(over.ask ?? (async () => answers.shift() ?? null)),
    sendLatest: vi.fn(over.sendLatest ?? (async () => V8)),
    submitRevision: vi.fn(over.submitRevision ?? (async (target: Confirmed) => `predano V${target.revision}`)),
  };
}

describe("submitConfirmed (INT-16)", () => {
  it("without a newer version on the device shows no warning and submits the confirmed revision", async () => {
    const d = deps({ hasNewer: async () => false });
    const result = await submitConfirmed(V7, d);
    expect(d.ask).not.toHaveBeenCalled();
    expect(d.sendLatest).not.toHaveBeenCalled();
    expect(d.submitRevision).toHaveBeenCalledTimes(1);
    expect(d.submitRevision).toHaveBeenCalledWith(V7);
    expect(result).toEqual({ kind: "submitted", target: V7, answer: "predano V7" });
  });

  it("a journal that cannot be read shows no warning either: the warning never holds a submission back", async () => {
    const d = deps({ hasNewer: async () => { throw new Error("blocked"); } });
    await submitConfirmed(V7, d);
    expect(d.ask).not.toHaveBeenCalled();
    expect(d.submitRevision).toHaveBeenCalledWith(V7);
  });

  it("'Pošalji najprije zadnju verziju pa predaj' sends first and submits the revision the server confirmed for it", async () => {
    const d = deps({ answers: ["latest"] });
    const result = await submitConfirmed(V7, d);
    expect(d.ask).toHaveBeenCalledWith(V7, false);
    expect(d.sendLatest).toHaveBeenCalledWith(V7);
    expect(d.sendLatest.mock.invocationCallOrder[0]).toBeLessThan(d.submitRevision.mock.invocationCallOrder[0] ?? 0);
    expect(d.submitRevision).toHaveBeenCalledTimes(1);
    expect(d.submitRevision).toHaveBeenCalledWith(V8);
    expect(result).toEqual({ kind: "submitted", target: V8, answer: "predano V8" });
  });

  it("'Predaj potvrđenu verziju V<n>' submits the confirmed revision and sends nothing else", async () => {
    const d = deps({ answers: ["confirmed"] });
    const result = await submitConfirmed(V7, d);
    expect(d.sendLatest).not.toHaveBeenCalled();
    expect(d.submitRevision).toHaveBeenCalledTimes(1);
    expect(d.submitRevision).toHaveBeenCalledWith(V7);
    expect(result).toEqual({ kind: "submitted", target: V7, answer: "predano V7" });
  });

  it("a newest version that does not arrive submits nothing and shows the warning again", async () => {
    const d = deps({ answers: ["latest", null], sendLatest: async () => null });
    const result = await submitConfirmed(V7, d);
    expect(d.ask).toHaveBeenNthCalledWith(2, V7, true);
    expect(d.submitRevision).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "cancelled" });
  });

  it("after a failed send the confirmed revision can still be chosen", async () => {
    const d = deps({ answers: ["latest", "confirmed"], sendLatest: async () => { throw new Error("offline"); } });
    await submitConfirmed(V7, d);
    expect(d.submitRevision).toHaveBeenCalledTimes(1);
    expect(d.submitRevision).toHaveBeenCalledWith(V7);
  });

  it("never submits a revision of another document or an older one", async () => {
    for (const wrong of [{ documentId: "doc-other", revision: 9 }, { documentId: V7.documentId, revision: 6 }]) {
      const d = deps({ answers: ["latest", null], sendLatest: async () => wrong });
      await submitConfirmed(V7, d);
      expect(d.submitRevision).not.toHaveBeenCalled();
    }
  });

  it("going back from the warning submits nothing", async () => {
    const d = deps({ answers: [null] });
    expect(await submitConfirmed(V7, d)).toEqual({ kind: "cancelled" });
    expect(d.submitRevision).not.toHaveBeenCalled();
  });
});

describe("waitForLatest (INT-16)", () => {
  it("waits until the device holds nothing newer, then reads the revision the server confirmed", async () => {
    let clock = 0;
    const holds = [true, true, false];
    const read = vi.fn(async () => V8);
    const latest = await waitForLatest(V7, {
      hasNewer: async () => holds.shift() ?? false, readConfirmed: read,
      sleep: async (ms) => { clock += ms; }, now: () => clock, limitMs: 10_000, everyMs: 1_000,
    });
    expect(latest).toEqual(V8);
    expect(read).toHaveBeenCalledTimes(1);
    expect(clock).toBe(2_000);
  });

  it("gives null once the limit has passed", async () => {
    let clock = 0;
    const latest = await waitForLatest(V7, {
      hasNewer: async () => true, readConfirmed: async () => V8,
      sleep: async (ms) => { clock += ms; }, now: () => clock, limitMs: 5_000, everyMs: 1_000,
    });
    expect(latest).toBeNull();
    expect(clock).toBeLessThanOrEqual(5_000);
  });
});

describe("the words of the warning", () => {
  it("name the confirmed revision exactly as the button says it", () => {
    expect(fill(t.newer.confirmed, { n: 1 })).toBe("Predaj potvrđenu verziju V1");
    expect(t.newer.latest).toBe("Pošalji najprije zadnju verziju pa predaj");
    expect(t.newer.title).not.toBe(t.dialogTitle);
  });
});
