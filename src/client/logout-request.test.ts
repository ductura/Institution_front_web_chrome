import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOGOUT_ALL_PATH, LOGOUT_PATH, logoutAllPath, logoutPath } from "./api";
import { LOGOUT_TIMEOUT_MS } from "./logout-hold";
import { browserSignOutDeps, followLogoutNatively, postLogout, postLogoutAll, signOutHere, type SignOutDeps } from "./logout-request";
import { CURRENT_KEY, ENDED_KEY, hasEnded, type CookieJar, type MarkStore } from "./session-marks";

// DAN-99: the shell's sign-out is the editor's request. F-285: it ends the
// session of the click on this device only once the route confirmed it; every
// other answer leaves everything as it was. Tags are invented.

const A = { tag: "tag-a", at: 1_000 };
const B = { tag: "tag-b", at: 2_000 };

type StoreKind = "works" | "refusesSetItem" | "none";

function storeOf(kind: StoreKind): (MarkStore & { data: Map<string, string> }) | null {
  if (kind === "none") return null;
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (kind === "refusesSetItem") throw new DOMException("Storage refused.", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
  };
}

function cookieJar(): CookieJar & { names: () => string[] } {
  const jar = new Map<string, string>();
  return {
    secure: true,
    read: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    write: (cookie) => {
      const [pair] = cookie.split(";");
      const at = pair!.indexOf("=");
      jar.set(pair!.slice(0, at), pair!.slice(at + 1));
    },
    names: () => [...jar.keys()],
  };
}

const response = (type: ResponseType, status: number): Response => {
  if (type === "opaqueredirect") return { type, status } as Response;
  return new Response(null, { status });
};

const ANSWERS: [string, () => typeof fetch, boolean][] = [
  ["the route's redirect", () => vi.fn(async () => response("opaqueredirect", 0)), true],
  ["a 200 without the redirect", () => vi.fn(async () => response("basic", 200)), false],
  ["a 503", () => vi.fn(async () => response("basic", 503)), false],
  ["no network", () => vi.fn(async () => { throw new TypeError("Failed to fetch"); }), false],
];

/** Nothing marked ended, no cookie, no announcement: the page still counts as signed in. */
function expectUntouched(store: ReturnType<typeof storeOf>, jar: ReturnType<typeof cookieJar>, announce: ReturnType<typeof vi.fn>): void {
  expect(jar.names()).toEqual([]);
  expect(hasEnded(store, A, jar)).toBe(false);
  expect(store?.data.has(ENDED_KEY) ?? false).toBe(false);
  expect(announce).not.toHaveBeenCalled();
}

beforeEach(() => vi.stubGlobal("location", new URL("https://demo.example.test")));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postLogout: true only for the route's redirect", () => {
  it.each(ANSWERS)("%s", async (_name, fetchOf, reached) => {
    const fetchImpl = fetchOf();
    await expect(postLogout(fetchImpl)).resolves.toBe(reached);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(new URL("https://demo.example.test/api/v1/auth/logout"), expect.objectContaining({
      method: "POST", redirect: "manual", cache: "no-store",
    }));
  });

  it("no answer within the limit aborts the request and is false", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const result = postLogout(fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(false);
    expect(signal?.aborted).toBe(true);
  });
});

describe("signOutHere: only the route's confirmation ends the session of the click here (F-285)", () => {
  const cases = ANSWERS.flatMap(([name, fetchOf, reached]) =>
    (["works", "refusesSetItem", "none"] as const).map((kind) => [name, kind, fetchOf, reached] as const));

  it.each(cases)("%s, storage %s", async (_name, kind, fetchOf, reached) => {
    const store = storeOf(kind);
    const jar = cookieJar();
    const announce = vi.fn();
    const fetchImpl = fetchOf();
    const deps: SignOutDeps = { post: () => postLogout(fetchImpl), store, jar, announce };

    await expect(signOutHere(A, deps)).resolves.toBe(reached);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    if (!reached) {
      expectUntouched(store, jar, announce);
      return;
    }
    // The cookie holds the end wherever localStorage refuses it (#1444).
    expect(jar.names()).toEqual(["ductus-ended-tag-a"]);
    expect(hasEnded(store, A, jar)).toBe(true);
    if (kind === "works") expect(JSON.parse(store!.data.get(ENDED_KEY)!)).toEqual(["tag-a"]);
    expect(announce.mock.calls).toEqual([["tag-a"]]);
  });

  it.each(["works", "refusesSetItem", "none"] as const)("no answer within the limit ends nothing, storage %s", async (kind) => {
    vi.useFakeTimers();
    const store = storeOf(kind);
    const jar = cookieJar();
    const announce = vi.fn();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const result = signOutHere(A, { post: () => postLogout(fetchImpl as unknown as typeof fetch), store, jar, announce });
    await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS);
    await expect(result).resolves.toBe(false);
    expectUntouched(store, jar, announce);
  });

  // Istodobnost (contract (b)): the route's redirect arriving after the limit
  // does not turn the attempt the page already showed as unconfirmed into an end.
  it.each(["works", "refusesSetItem", "none"] as const)("a confirmation that arrives after the limit ends nothing, storage %s", async (kind) => {
    vi.useFakeTimers();
    const store = storeOf(kind);
    const jar = cookieJar();
    const announce = vi.fn();
    // A fetch that ignores the abort and answers late.
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      setTimeout(() => resolve(response("opaqueredirect", 0)), LOGOUT_TIMEOUT_MS + 500);
    }));
    const result = signOutHere(A, { post: () => postLogout(fetchImpl as unknown as typeof fetch), store, jar, announce });
    await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS + 1_000);
    await expect(result).resolves.toBe(false);
    expectUntouched(store, jar, announce);
  });

  it("without a page mark it ends the session the browser records at the click", async () => {
    const store = storeOf("works")!;
    store.data.set(CURRENT_KEY, JSON.stringify(A));
    const jar = cookieJar();
    await signOutHere(null, { post: async () => true, store, jar, announce: vi.fn() });
    expect(hasEnded(store, A, jar)).toBe(true);
  });

  it("without any session it ends nobody and announces nothing", async () => {
    const store = storeOf("works")!;
    const jar = cookieJar();
    const announce = vi.fn();
    await expect(signOutHere(null, { post: async () => false, store, jar, announce })).resolves.toBe(false);
    expect(jar.names()).toEqual([]);
    expect(store.data.has(ENDED_KEY)).toBe(false);
    expect(announce).not.toHaveBeenCalled();
  });

  it.each(["works", "refusesSetItem", "none"] as const)("a post that rejects ends nothing, storage %s", async (kind) => {
    const store = storeOf(kind);
    const jar = cookieJar();
    const announce = vi.fn();
    await expect(signOutHere(A, { post: () => Promise.reject(new Error("lost")), store, jar, announce }))
      .resolves.toBe(false);
    expectUntouched(store, jar, announce);
  });

  it("an announcement that throws still ends a confirmed sign-out here", async () => {
    const store = storeOf("works")!;
    const jar = cookieJar();
    const announce = () => { throw new Error("channel closed"); };
    await expect(signOutHere(A, { post: async () => true, store, jar, announce })).resolves.toBe(true);
    expect(hasEnded(store, A, jar)).toBe(true);
  });

  it("a sign-in elsewhere while the POST waits stays", async () => {
    const reached = true;
    const store = storeOf("works")!;
    store.data.set(CURRENT_KEY, JSON.stringify(A));
    const jar = cookieJar();
    const announce = vi.fn();
    const post = async () => {
      store.data.set(CURRENT_KEY, JSON.stringify(B));
      return reached;
    };
    await signOutHere(null, { post, store, jar, announce });
    expect(hasEnded(store, A, jar)).toBe(true);
    expect(hasEnded(store, B, jar)).toBe(false);
    expect(JSON.parse(store.data.get(CURRENT_KEY)!)).toEqual(B);
    expect(announce.mock.calls).toEqual([["tag-a"]]);
  });
});

describe("followLogoutNatively", () => {
  it("submits a hidden POST form to the route, without a condition", () => {
    type Fake = { tag: string; children: unknown[]; submitted: boolean; [key: string]: unknown };
    const body: Fake = { tag: "body", children: [], submitted: false };
    body.append = (child: unknown) => void body.children.push(child);
    const createElement = (tag: string): Fake => {
      const element: Fake = { tag, children: [], submitted: false };
      element.append = (child: unknown) => void element.children.push(child);
      element.submit = () => void (element.submitted = true);
      return element;
    };
    vi.stubGlobal("document", { body, createElement });
    followLogoutNatively();
    expect(body.children).toEqual([expect.objectContaining({
      tag: "form", method: "post", action: "/api/v1/auth/logout", hidden: true, submitted: true, children: [],
    })]);
  });
});

describe("logoutPath (WEB-39)", () => {
  const post = (operationId: string) => ({ post: { operationId, responses: {} } });

  it("reads the route from the contract", () => {
    expect(LOGOUT_PATH).toBe("/api/v1/auth/logout");
    expect(logoutPath({ "/x/logout": post("auth.logout.post"), "/x/logout-all": post("auth.logout-all.post") })).toBe("/x/logout");
  });

  it("throws when the contract has none, two, or no local path", () => {
    expect(() => logoutPath({ "/x/logout-all": post("auth.logout-all.post") })).toThrow("auth.logout.post");
    expect(() => logoutPath({ "/a": post("auth.logout.post"), "/b": post("auth.logout.post") })).toThrow("auth.logout.post");
    expect(() => logoutPath({ "https://evil.example/logout": post("auth.logout.post") })).toThrow("auth.logout.post");
    expect(() => logoutPath({ "//evil.example/logout": post("auth.logout.post") })).toThrow("auth.logout.post");
  });

  it("the form posts to the route the contract names, on the document it is given", () => {
    const appended: { action?: string; submitted?: boolean }[] = [];
    const form = { method: "", action: "", hidden: false, submitted: false, submit() { this.submitted = true; } };
    followLogoutNatively({
      createElement: (() => form) as unknown as Document["createElement"],
      body: { append: (node: typeof form) => void appended.push(node) } as unknown as HTMLElement,
    });
    expect(appended).toEqual([expect.objectContaining({ method: "post", action: LOGOUT_PATH, hidden: true, submitted: true })]);
  });
});

describe("postLogoutAll: auth.logout-all.post, true only for the route's redirect (OPE-30)", () => {
  it.each(ANSWERS)("%s", async (_name, fetchOf, reached) => {
    const fetchImpl = fetchOf();
    await expect(postLogoutAll(fetchImpl)).resolves.toBe(reached);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(new URL(`https://demo.example.test${LOGOUT_ALL_PATH}`), expect.objectContaining({
      method: "POST", redirect: "manual", cache: "no-store",
    }));
  });

  it("goes to its own route, not the single sign-out's", () => {
    expect(LOGOUT_ALL_PATH).toBe("/api/v1/auth/logout-all");
    expect(LOGOUT_ALL_PATH).not.toBe(LOGOUT_PATH);
  });

  it("a refusal (403) or an unavailable server ends nothing on this device", async () => {
    for (const status of [403, 503]) {
      const store = storeOf("works");
      const jar = cookieJar();
      const announce = vi.fn();
      const fetchImpl = vi.fn(async () => response("basic", status));
      await expect(signOutHere(A, { post: () => postLogoutAll(fetchImpl), store, jar, announce })).resolves.toBe(false);
      expectUntouched(store, jar, announce);
    }
  });

  it("ends the session here once the route confirmed it", async () => {
    const store = storeOf("works");
    const jar = cookieJar();
    const announce = vi.fn();
    const fetchImpl = vi.fn(async () => response("opaqueredirect", 0));
    await expect(signOutHere(A, { post: () => postLogoutAll(fetchImpl), store, jar, announce })).resolves.toBe(true);
    expect(hasEnded(store, A, jar)).toBe(true);
  });

  it("the shell picks the route by its flag", async () => {
    const fetchImpl = vi.fn(async () => response("opaqueredirect", 0));
    vi.stubGlobal("fetch", fetchImpl);
    await browserSignOutDeps(true).post();
    await browserSignOutDeps(false).post();
    const urls = fetchImpl.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls[0]).toContain("/auth/logout-all");
    expect(urls[1]).not.toContain("/auth/logout-all");
  });
});

describe("logoutAllPath (OPE-30)", () => {
  const post = (operationId: string) => ({ post: { operationId, responses: {} } });

  it("reads the route from the contract", () => {
    expect(logoutAllPath({ "/x/logout": post("auth.logout.post"), "/x/logout-all": post("auth.logout-all.post") })).toBe("/x/logout-all");
  });

  it("throws when the contract has none, two, or no local path", () => {
    expect(() => logoutAllPath({ "/x/logout": post("auth.logout.post") })).toThrow("auth.logout-all.post");
    expect(() => logoutAllPath({ "/a": post("auth.logout-all.post"), "/b": post("auth.logout-all.post") })).toThrow("auth.logout-all.post");
    expect(() => logoutAllPath({ "//evil.example/x": post("auth.logout-all.post") })).toThrow("auth.logout-all.post");
  });
});
