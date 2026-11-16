// IndexedDB and localStorage in private windows (web PLAN §6, integration):
// fakes that fail the way Firefox and Safari private windows do. Real
// browsers run these paths in the 2.c6 matrix.
import { afterEach, describe, expect, it, vi } from "vitest";
import { messagesHr } from "../../locales/hr.ts";
import { memoryStorage, PROBE_DATABASE, probeIndexedDb, safeLocalStorage, type ProbeIdbFactory, type ProbeOpenRequest, type StorageLike } from "./storage.ts";

type Outcome = "success" | "error" | "never";

function fakeFactory(outcome: Outcome, delayMs = 0) {
  const deleted: string[] = [];
  const opened: string[] = [];
  let closed = 0;
  let pending: ProbeOpenRequest | undefined;
  const factory: ProbeIdbFactory = {
    open(name) {
      opened.push(name);
      const request: ProbeOpenRequest = { onsuccess: null, onerror: null, result: { close: () => void closed++ } };
      pending = request;
      if (outcome !== "never") {
        setTimeout(() => (outcome === "success" ? request.onsuccess?.({}) : request.onerror?.({})), delayMs);
      }
      return request;
    },
    deleteDatabase: (name) => void deleted.push(name),
  };
  return { factory, deleted, opened, closed: () => closed, pending: () => pending };
}

const WARNING = { state: "unavailable", messageKey: "editor.failureUnavailable" } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("probeIndexedDb", () => {
  it("is available after a real onsuccess, and deletes the probe database", async () => {
    const fake = fakeFactory("success");
    await expect(probeIndexedDb({ indexedDB: fake.factory })).resolves.toEqual({ state: "available" });
    expect(fake.opened).toEqual([PROBE_DATABASE]);
    expect(fake.deleted).toEqual([PROBE_DATABASE]);
    expect(fake.closed()).toBe(1);
  });

  it("warns in a Firefox private window (open fails with InvalidStateError)", async () => {
    const fake = fakeFactory("error");
    await expect(probeIndexedDb({ indexedDB: fake.factory })).resolves.toEqual({ ...WARNING, reason: "error" });
    expect(messagesHr.editor.failureUnavailable).toBe("Spremanje na ovom uređaju nije dostupno. Izvezite tekst da ga ne izgubite.");
  });

  it("warns in a Safari private window (open throws SecurityError)", async () => {
    const factory: ProbeIdbFactory = {
      open: () => {
        throw Object.assign(new Error("The operation is insecure."), { name: "SecurityError" });
      },
      deleteDatabase: () => undefined,
    };
    await expect(probeIndexedDb({ indexedDB: factory })).resolves.toEqual({ ...WARNING, reason: "blocked" });
  });

  it("warns when indexedDB is missing, null, not a factory, or its getter throws", async () => {
    await expect(probeIndexedDb({})).resolves.toEqual({ ...WARNING, reason: "missing" });
    await expect(probeIndexedDb({ indexedDB: null })).resolves.toEqual({ ...WARNING, reason: "missing" });
    await expect(probeIndexedDb({ indexedDB: {} as ProbeIdbFactory })).resolves.toEqual({ ...WARNING, reason: "missing" });
    const throwing = {
      get indexedDB(): never {
        throw new Error("SecurityError");
      },
    };
    await expect(probeIndexedDb(throwing)).resolves.toEqual({ ...WARNING, reason: "blocked" });
  });

  it("times out when nothing answers", async () => {
    vi.useFakeTimers();
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
  });

  it("stays timeout when onsuccess comes after the deadline, and still deletes the probe database", async () => {
    vi.useFakeTimers();
    const fake = fakeFactory("success", 5000);
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
    expect(fake.deleted).toEqual([]);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
    expect(fake.deleted).toEqual([PROBE_DATABASE]);
    expect(fake.closed()).toBe(1);
  });

  it("never reports available without onsuccess, even with a zero or invalid deadline", async () => {
    for (const ms of [0, -5, Number.NaN, Infinity]) {
      vi.useFakeTimers();
      const answer = probeIndexedDb({ indexedDB: fakeFactory("never").factory }, ms);
      await vi.advanceTimersByTimeAsync(1);
      await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
      vi.useRealTimers();
    }
  });

  it("is an error when the request rejects its handlers", async () => {
    const factory: ProbeIdbFactory = {
      open: () =>
        ({
          set onsuccess(_: unknown) {
            throw new Error("frozen");
          },
        }) as unknown as ProbeOpenRequest,
      deleteDatabase: () => undefined,
    };
    await expect(probeIndexedDb({ indexedDB: factory }, 50)).resolves.toEqual({ ...WARNING, reason: "error" });
  });

  it("still answers when close and deleteDatabase throw", async () => {
    const fake = fakeFactory("success");
    fake.factory.deleteDatabase = () => {
      throw new Error("blocked");
    };
    await expect(probeIndexedDb({ indexedDB: fake.factory })).resolves.toEqual({ state: "available" });
  });
});

describe("safeLocalStorage", () => {
  it("keeps localStorage when it writes and reads back", () => {
    const real = memoryStorage();
    const { storage, persistent } = safeLocalStorage({ localStorage: real });
    expect(persistent).toBe(true);
    expect(storage).toBe(real);
    expect(real.length).toBe(0);
  });

  it("falls back to memory with persistent false in a Safari private window (quota 0)", () => {
    const quotaZero: StorageLike = {
      ...memoryStorage(),
      setItem: () => {
        throw Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" });
      },
    };
    const { storage, persistent } = safeLocalStorage({ localStorage: quotaZero });
    expect(persistent).toBe(false);
    expect(storage).not.toBe(quotaZero);
    storage.setItem("a", "1");
    expect(storage.getItem("a")).toBe("1");
  });

  it("falls back when localStorage is missing, its getter throws, or writes are dropped", () => {
    expect(safeLocalStorage({}).persistent).toBe(false);
    const throwing = {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    };
    expect(safeLocalStorage(throwing).persistent).toBe(false);
    const dropping: StorageLike = { ...memoryStorage(), setItem: () => undefined, getItem: () => null };
    expect(safeLocalStorage({ localStorage: dropping }).persistent).toBe(false);
  });
});

describe("memoryStorage", () => {
  it("behaves as Storage", () => {
    const s = memoryStorage();
    s.setItem("k", "v");
    s.setItem("n", 1 as unknown as string);
    expect([s.length, s.key(0), s.getItem("n"), s.key(5)]).toEqual([2, "k", "1", null]);
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });
});
