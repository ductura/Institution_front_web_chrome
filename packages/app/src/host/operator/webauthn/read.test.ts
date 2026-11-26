import { describe, expect, it, vi } from "vitest";

import { fromBase64Url, toBase64Url } from "./encode";
import { confirmWithKey, registerKey, type Credentials } from "./read";

const baseUrl = "https://ductura.example.invalid";
const challenge = "A".repeat(43);
const handle = "B".repeat(22);
const bytes = (...n: number[]) => new Uint8Array(n).buffer;
const registration = { challenge, rpId: "ductura.example.invalid", timeoutMs: 60000, purpose: "registration", userHandle: handle };
const assertion = (allowCredentials: string[]) => ({ challenge, rpId: "ductura.example.invalid", timeoutMs: 60000, purpose: "assertion", allowCredentials });

function server(first: Response, second: Response = new Response(null, { status: 204 })) {
  const seen: { url: string; body: unknown }[] = [];
  const queue = [first, second];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: new URL(String(input)).pathname, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return queue.shift() ?? new Response(null, { status: 500 });
  };
  return { fetchImpl, seen };
}
const created = { rawId: bytes(1, 2, 3), response: { clientDataJSON: bytes(4, 5), getAuthenticatorData: () => bytes(6, 7) } };
const got = { rawId: bytes(1, 2, 3), response: { clientDataJSON: bytes(4, 5), authenticatorData: bytes(6, 7), signature: bytes(8, 9) } };
const credentials = (over: Partial<Record<"create" | "get", unknown>> = {}) => ({ create: vi.fn(async () => created), get: vi.fn(async () => got), ...over }) as unknown as Credentials;

describe("base64url", () => {
  it("vraća iste bajtove i odbija znakove izvan abecede", () => {
    expect(toBase64Url(bytes(251, 255, 254))).toBe("-__-");
    expect([...fromBase64Url("-__-")]).toEqual([251, 255, 254]);
    expect(() => fromBase64Url("a+b/")).toThrow();
  });
});

describe("registracija ključa", () => {
  it("šalje samo ono što je ugovor imenovao, nakon izazova poslužitelja", async () => {
    const { fetchImpl, seen } = server(Response.json(registration));
    const store = credentials();
    await expect(registerKey({ baseUrl, fetchImpl, credentials: store })).resolves.toEqual({ kind: "done" });
    expect(seen.map((s) => s.url)).toEqual(["/api/v1/auth/webauthn/challenge", "/api/v1/auth/webauthn/registration"]);
    expect(seen[0]?.body).toEqual({ purpose: "registration" });
    expect(seen[1]?.body).toEqual({ credentialId: toBase64Url(bytes(1, 2, 3)), clientDataJSON: toBase64Url(bytes(4, 5)), authenticatorData: toBase64Url(bytes(6, 7)) });
  });

  it("bez podrške preglednika ne zove poslužitelj", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const none = vi.spyOn(globalThis, "navigator", "get").mockReturnValue({} as Navigator);
    await expect(registerKey({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "unsupported" });
    none.mockRestore();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("prekid korisnika ne šalje ništa poslužitelju", async () => {
    const { fetchImpl, seen } = server(Response.json(registration));
    const store = credentials({ create: vi.fn(async () => { throw new DOMException("no", "NotAllowedError"); }) });
    await expect(registerKey({ baseUrl, fetchImpl, credentials: store })).resolves.toEqual({ kind: "cancelled" });
    expect(seen).toHaveLength(1);
  });

  it.each([
    [401, "denied"], [403, "denied"], [409, "already"], [422, "rejected"], [503, "unavailable"],
  ] as const)("odgovor %s na završetku je '%s', a ne uspjeh", async (status, kind) => {
    const { fetchImpl } = server(Response.json(registration), Response.json({ code: "x" }, { status }));
    await expect(registerKey({ baseUrl, fetchImpl, credentials: credentials() })).resolves.toEqual({ kind });
  });

  it("izazov druge vrste nije izazov za registraciju", async () => {
    const { fetchImpl } = server(Response.json(assertion(["x"])));
    await expect(registerKey({ baseUrl, fetchImpl, credentials: credentials() })).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("potvrda ključem", () => {
  it("bez dodanog ključa kaže to, a ne otvara dijalog preglednika", async () => {
    const { fetchImpl } = server(Response.json(assertion([])));
    const store = credentials();
    await expect(confirmWithKey({ baseUrl, fetchImpl, credentials: store })).resolves.toEqual({ kind: "no-key" });
    expect(store.get).not.toHaveBeenCalled();
  });

  it("šalje potpis i traži samo dopuštene ključeve", async () => {
    const { fetchImpl, seen } = server(Response.json(assertion([toBase64Url(bytes(1, 2, 3))])));
    const store = credentials();
    await expect(confirmWithKey({ baseUrl, fetchImpl, credentials: store })).resolves.toEqual({ kind: "done" });
    expect(seen[1]?.body).toEqual({ credentialId: toBase64Url(bytes(1, 2, 3)), clientDataJSON: toBase64Url(bytes(4, 5)), authenticatorData: toBase64Url(bytes(6, 7)), signature: toBase64Url(bytes(8, 9)) });
    const options = (store.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { publicKey: { allowCredentials: unknown[]; userVerification: string } };
    expect(options.publicKey.allowCredentials).toHaveLength(1);
    expect(options.publicKey.userVerification).toBe("required");
  });

  it("409 brojača je 'replay', 400 neispravnog izazova je 'replay', ostalo odbijanje", async () => {
    const allowed = Response.json(assertion([toBase64Url(bytes(1))]));
    const run = (second: Response) => confirmWithKey({ baseUrl, credentials: credentials(), fetchImpl: server(allowed.clone(), second).fetchImpl });
    await expect(run(Response.json({ code: "counter_not_increased" }, { status: 409 }))).resolves.toEqual({ kind: "replay" });
    await expect(run(Response.json({ code: "challenge_invalid" }, { status: 400 }))).resolves.toEqual({ kind: "replay" });
    await expect(run(Response.json({ code: "ceremony_invalid" }, { status: 400 }))).resolves.toEqual({ kind: "rejected" });
  });

  it("bez prijavljene sesije (401) je 'denied'", async () => {
    const { fetchImpl } = server(Response.json({ code: "unauthorized" }, { status: 401 }));
    await expect(confirmWithKey({ baseUrl, fetchImpl, credentials: credentials() })).resolves.toEqual({ kind: "denied" });
  });
});
