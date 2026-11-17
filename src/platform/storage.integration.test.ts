// IndexedDB and localStorage in private windows (web PLAN §6, integration):
// fakes that fail the way Firefox and Safari private windows do. Real
// browsers run these paths in the 2.c6 matrix.
import { afterEach, describe, expect, it, vi } from "vitest";
import { messagesHr } from "../../locales/hr.ts";
import { memoryStorage, PROBE_DATABASE, probeIndexedDb, safeLocalStorage, type ProbeIdbFactory, type ProbeOpenRequest, type StorageLike } from "./storage.ts";

type Outcome = "success" | "error" | "never";

function fakeFactory(outcome: Outcome, delayMs = 0, closeThrows = false) {
  const deleted: string[] = [];
  const opened: string[] = [];
  let closed = 0;
  let pending: ProbeOpenRequest | undefined;
  const factory: ProbeIdbFactory = {
    open(name) {
      opened.push(name);
      const request: ProbeOpenRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          close: () => {
            closed++;
            if (closeThrows) throw new Error("InvalidStateError");
          },
        },
      };
      pending = request;
      if (outcome !== "never") {
        setTimeout(() => (outcome === "success" ? request.onsuccess?.({} as never) : request.onerror?.({} as never)), delayMs);
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  // The monotonic clock is driven by hand; the timer itself (2000 ms) never
  // runs inside these tests, which is the busy main thread case.
  function monotonic(start = 1000) {
    let now = start;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    return (ms: number) => void (now += ms);
  }

  it("is timeout when onsuccess runs after the deadline but before the timer callback (busy main thread)", async () => {
    const advance = monotonic();
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    advance(2001);
    fake.pending()!.onsuccess?.({} as never);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
    expect(fake.deleted).toEqual([PROBE_DATABASE]);
    expect(fake.closed()).toBe(1);
  });

  it("is timeout when onerror runs after the deadline but before the timer callback (busy main thread)", async () => {
    const advance = monotonic();
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    advance(2500);
    fake.pending()!.onerror?.({} as never);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
    expect(fake.deleted).toEqual([PROBE_DATABASE]);
  });

  it("stays timeout when the wall clock is set back while the main thread is busy", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10_000);
    const advance = monotonic();
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    advance(2500);
    vi.setSystemTime(9_000);
    fake.pending()!.onsuccess?.({} as never);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
  });

  it("is available when onsuccess runs exactly at the deadline", async () => {
    const advance = monotonic();
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    advance(2000);
    fake.pending()!.onsuccess?.({} as never);
    await expect(answer).resolves.toEqual({ state: "available" });
  });

  it("is timeout, never available, without a monotonic clock", async () => {
    vi.stubGlobal("performance", undefined);
    const fake = fakeFactory("never");
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    fake.pending()!.onsuccess?.({} as never);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
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
    const fake = fakeFactory("success", 0, true);
    fake.factory.deleteDatabase = () => {
      throw new Error("blocked");
    };
    await expect(probeIndexedDb({ indexedDB: fake.factory })).resolves.toEqual({ state: "available" });
  });

  it("warns, not throws, when the open getter throws", async () => {
    const factory = {
      get open(): never {
        throw new Error("SecurityError");
      },
      deleteDatabase: () => undefined,
    } as unknown as ProbeIdbFactory;
    await expect(probeIndexedDb({ indexedDB: factory })).resolves.toEqual({ ...WARNING, reason: "blocked" });
  });

  it("is available, and still deletes, when the result getter throws on success", async () => {
    const deleted: string[] = [];
    const factory: ProbeIdbFactory = {
      open: () => {
        const request = {
          onsuccess: null,
          onerror: null,
          get result(): never {
            throw new Error("InvalidStateError");
          },
        } as ProbeOpenRequest;
        setTimeout(() => request.onsuccess?.({} as never), 0);
        return request;
      },
      deleteDatabase: (name) => void deleted.push(name),
    };
    await expect(probeIndexedDb({ indexedDB: factory })).resolves.toEqual({ state: "available" });
    expect(deleted).toEqual([PROBE_DATABASE]);
  });

  it("stays timeout when onerror comes after the deadline, and still cleans up", async () => {
    vi.useFakeTimers();
    const fake = fakeFactory("error", 5000);
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 2000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(answer).resolves.toEqual({ ...WARNING, reason: "timeout" });
    expect(fake.deleted).toEqual([PROBE_DATABASE]);
  });

  it("clamps a deadline beyond the timer limit instead of timing out at once", async () => {
    vi.useFakeTimers();
    const fake = fakeFactory("success", 5);
    const answer = probeIndexedDb({ indexedDB: fake.factory }, 3e9);
    await vi.advanceTimersByTimeAsync(5);
    await expect(answer).resolves.toEqual({ state: "available" });
  });

  it("accepts the real window type", () => {
    // Type-level only: the DOM's IDBFactory and Storage fit the probe types.
    const check = (w: Window) => [probeIndexedDb(w, 0), safeLocalStorage(w)];
    expect(typeof check).toBe("function");
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
    const thrower = () => {
      throw new Error("SecurityError");
    };
    expect(safeLocalStorage({ localStorage: { ...memoryStorage(), getItem: thrower } }).persistent).toBe(false);
    expect(safeLocalStorage({ localStorage: { ...memoryStorage(), removeItem: thrower } }).persistent).toBe(false);
  });
});

describe("memoryStorage", () => {
  it("behaves as Storage", () => {
    const s = memoryStorage();
    s.setItem("k", "v");
    s.setItem("n", 1 as unknown as string);
    expect([s.length, s.key(0), s.getItem("n"), s.key(5)]).toEqual([2, "k", "1", null]);
    expect([s.key(Number.NaN), s.key(1.9)]).toEqual(["k", "n"]);
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });
});
