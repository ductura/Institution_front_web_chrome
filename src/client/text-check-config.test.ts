// WEB-1102: the text check configuration read through createApi, over the
// vectors of the route and a stub transport. The route has no body; the answer
// is exactly {enabledCheckIds, lektaProfileId}.
import { describe, expect, it, vi } from "vitest";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { fetchTextCheckConfig } from "./text-check-config";

const ID = "4b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01";
const ready = vectors.find((v) => v.route === "student.text-check-config.get" && v.name === "ready")!;
const answer = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const options = (fetchImpl: ReturnType<typeof answer>) => ({ baseUrl: "https://ductura.example.invalid", fetchImpl });

describe("fetchTextCheckConfig", () => {
  it("asks with GET and no body and returns each id once", async () => {
    const fetchImpl = answer(200, { enabledCheckIds: ["num", "long", "num"], lektaProfileId: null });
    const outcome = await fetchTextCheckConfig(ID, () => true, options(fetchImpl));
    expect(outcome).toEqual({ kind: "ok", config: { enabledCheckIds: ["num", "long"], lektaProfileId: null } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`https://ductura.example.invalid/api/v1/student/assignments/${ID}/text-check-config`);
    expect(init?.method).toBe("GET");
    expect(init?.body ?? undefined).toBeUndefined();
  });

  it("reads the vector of the route", async () => {
    const outcome = await fetchTextCheckConfig(ID, () => true, options(answer(200, ready.response.body)));
    expect(outcome.kind).toBe("ok");
  });

  it("sends nothing once the session has ended", async () => {
    const fetchImpl = answer(200, ready.response.body);
    expect(await fetchTextCheckConfig(ID, () => false, options(fetchImpl))).toEqual({ kind: "signedOut" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps 401, 404 and everything else", async () => {
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(401, { error: "unauthorized" })))).kind).toBe("signedOut");
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(404, { error: "not_found" })))).kind).toBe("notFound");
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(503, { error: "unavailable" })))).kind).toBe("unavailable");
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect((await fetchTextCheckConfig(ID, () => true, { baseUrl: "https://ductura.example.invalid", fetchImpl: down })).kind).toBe("unavailable");
  });

  it("refuses an answer with a field the contract does not name or a missing one", async () => {
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(200, { enabledCheckIds: [], lektaProfileId: null, extra: 1 })))).kind).toBe("unavailable");
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(200, { enabledCheckIds: ["num"] })))).kind).toBe("unavailable");
    expect((await fetchTextCheckConfig(ID, () => true, options(answer(200, { enabledCheckIds: [1], lektaProfileId: null })))).kind).toBe("unavailable");
  });
});
