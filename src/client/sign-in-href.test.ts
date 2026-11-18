// DAN-1081 (1081-W1): the sign-in link. Its path and query name come from the
// contract (auth.login.get), and returnTo goes in only when the server's rule
// (ductura/server server/session/return-to.ts) keeps it; the attack table is
// the one of that rule's own tests, so the client is never wider than the
// server. Invented paths and hosts only.
import { createClient } from "@ductura/contracts";
import { describe, expect, it } from "vitest";
import { LOGIN_ROUTE, loginRoute, signInHref, signInReturnTo } from "./api";

const ORIGIN = "https://web.invalid";
const PLAIN = LOGIN_ROUTE.path;

/** The path createClient itself sends for auth.login.get, read on the wire. */
async function wirePath(): Promise<string> {
  let sent = "";
  const capture: typeof fetch = (input) => {
    sent = String(input);
    return Promise.resolve(new Response(null, { status: 303, headers: { location: "/" } }));
  };
  await createClient(ORIGIN, capture)("auth.login.get", { params: undefined, query: { returnTo: "/rad" }, body: undefined });
  return new URL(sent).pathname;
}

const ATTACKS: readonly [string, unknown][] = [
  ["absolute URL", "https://zlo.test/"],
  ["absolute URL, other scheme", "javascript:alert(1)"],
  ["absolute URL, data", "data:text/html,x"],
  ["bare host", "zlo.test"],
  ["protocol-relative", "//zlo.test"],
  ["protocol-relative, backslash", "/\\zlo.test"],
  ["two backslashes", "\\\\zlo.test"],
  ["slash backslash slash", "/\\/zlo.test"],
  ["backslash inside", "/rad\\zlo.test"],
  ["encoded slashes, not a path", "%2F%2Fzlo.test"],
  ["dot segment to //", "/.//zlo.test"],
  ["dot dot segment to //", "/a/..//zlo.test"],
  ["encoded dot to //", "/%2e//zlo.test"],
  ["encoded dot dot to //", "/%2E%2E//zlo.test"],
  ["dot segment with query", "/.//zlo.test/x?y=1"],
  ["dot segment to /\\", "/./\\zlo.test"],
  ["dot dot to /\\", "/a/../\\zlo.test"],
  ["tab", "/\tzlo.test"],
  ["line feed", "/\n/zlo.test"],
  ["carriage return", "/rad\r\n"],
  ["NUL", "/\u0000"],
  ["lone surrogate", "/\ud800"],
  ["zero width space", "/​/zlo.test"],
  ["left-to-right mark", "/‎/zlo.test"],
  ["right-to-left override", "/rad‮"],
  ["line separator", "/rad "],
  ["api route", "/api/auth/login"],
  ["api prefix", "/api"],
  ["api with query", "/api?x=1"],
  ["api with hash", "/api#x"],
  ["api upper case", "/API"],
  ["api mixed case", "/Api/x"],
  ["api encoded letter", "/%61pi/x"],
  ["api encoded upper", "/%41PI"],
  ["api encoded slashes", "/api%2Fauth%2Flogin"],
  ["api double encoded", "/%2561pi"],
  ["api triple encoded", "/%252561pi/x"],
  ["undecodable", "/%E0%A4%A"],
  ["empty", ""],
  ["over 512", `/${"a".repeat(512)}`],
  ["undefined", undefined],
  ["null", null],
  ["number", 42],
  ["array", ["/rad"]],
  ["object", { path: "/rad" }],
  ["object with toString", { toString: () => "/rad" }],
  ["String object", new String("/rad")],
  ["symbol", Symbol("/rad")],
];

const KEPT: readonly [string, string, string][] = [
  ["valid path", "/rad", "/rad"],
  ["root", "/", "/"],
  ["path with query", "/rad?x=1", "/rad?x=1"],
  ["path with hash", "/kolegij/DEMO-101#upute", "/kolegij/DEMO-101#upute"],
  ["path with query and hash", "/rad/%C5%A1kola?q=a%20b#x%20y", "/rad/%C5%A1kola?q=a%20b#x%20y"],
  ["encoded slashes stay a path", "/%2F%2Fzlo.test", "/%2F%2Fzlo.test"],
  ["dot segment removed", "/a/../b", "/b"],
  ["only /api itself is refused", "/apis", "/apis"],
  ["api deeper is a path", "/rad/api", "/rad/api"],
  ["exactly 512", `/${"a".repeat(511)}`, `/${"a".repeat(511)}`],
  ["query with & and =", "/rad?a=1&b=2", "/rad?a=1&b=2"],
];

describe("the login route comes from the contract", () => {
  it("is the path of auth.login.get that the generated client sends to", async () => {
    expect(LOGIN_ROUTE.path).toBe(await wirePath());
    expect(LOGIN_ROUTE.param).toBe("returnTo");
  });

  it("refuses a contract without a single GET auth.login.get with returnTo", () => {
    const op = (operationId: string, names: string[] = ["returnTo"]) => ({
      operationId,
      responses: {},
      parameters: names.map((name) => ({ name, in: "query" })),
    });
    expect(() => loginRoute({})).toThrow();
    expect(() => loginRoute({ "/x": { get: op("auth.callback.get") } })).toThrow();
    expect(() => loginRoute({ "/x": { post: op("auth.login.get") } })).toThrow();
    expect(() => loginRoute({ "/x": { get: op("auth.login.get", []) } })).toThrow();
    expect(() => loginRoute({ "/x": { get: op("auth.login.get", ["next"]) } })).toThrow();
    expect(() => loginRoute({ "/x": { get: op("auth.login.get") }, "/y": { get: op("auth.login.get") } })).toThrow();
    expect(() => loginRoute({ "//zlo.test/x": { get: op("auth.login.get") } })).toThrow();
    expect(() => loginRoute({ "https://zlo.test/x": { get: op("auth.login.get") } })).toThrow();
    expect(loginRoute({ "/x": { get: op("auth.login.get") } })).toEqual({ path: "/x", param: "returnTo" });
  });
});

describe("signInHref", () => {
  it("without returnTo is the plain login link", () => {
    expect(signInHref()).toBe(PLAIN);
  });

  it.each(ATTACKS)("drops returnTo: %s", (_, value) => {
    expect(signInReturnTo(value)).toBeNull();
    expect(signInHref(value)).toBe(PLAIN);
  });

  it.each(KEPT)("keeps returnTo: %s", (_, value, expected) => {
    expect(signInReturnTo(value)).toBe(expected);
    const href = new URL(signInHref(value), ORIGIN);
    expect(href.pathname).toBe(PLAIN);
    expect([...href.searchParams.keys()]).toEqual([LOGIN_ROUTE.param]);
    expect(href.searchParams.get(LOGIN_ROUTE.param)).toBe(expected);
    expect(href.hash).toBe("");
  });

  it.each([...ATTACKS.map(([, v]) => v), ...KEPT.map(([, v]) => v)])("is a same-origin relative link for %j", (value) => {
    const href = signInHref(value);
    expect(href.startsWith("/")).toBe(true);
    expect(href.startsWith("//")).toBe(false);
    expect(href).not.toMatch(/[\\\s#]/);
    expect(new URL(href, ORIGIN).origin).toBe(ORIGIN);
  });

  it("never throws, even when reading the value throws", () => {
    const hostile = new Proxy({}, { get: () => { throw new Error("boom"); } });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [hostile, revoked.proxy, Object.create(null)]) {
      expect(() => signInHref(value)).not.toThrow();
      expect(signInHref(value)).toBe(PLAIN);
    }
  });

  it("every single character after / is either dropped or kept on this origin", () => {
    for (let code = 0; code <= 0xffff; code += 1) {
      const kept = signInReturnTo(`/${String.fromCharCode(code)}x`);
      if (kept !== null) {
        expect(kept.startsWith("/")).toBe(true);
        expect(kept.startsWith("//")).toBe(false);
        expect(new URL(kept, ORIGIN).origin).toBe(ORIGIN);
      }
    }
  });
});
