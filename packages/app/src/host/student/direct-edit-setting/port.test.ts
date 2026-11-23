import { describe, expect, it, vi } from "vitest";

import { changeDirectEdit } from "./model";
import { directEditPort } from "./port";

const baseUrl = "https://ductura.example.invalid";
const documentId = "11111111-1111-4111-8111-111111111111";
const at = "2026-11-22T10:00:00.000Z";
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("stvarni port izravnih izmjena", () => {
  it("čita postavku iz work.direct-edit.get i prevodi način u stanje", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ mode: "direct", changedAt: at, record: [] }));
    await expect(directEditPort({ baseUrl, fetchImpl }).read(documentId))
      .resolves.toEqual({ kind: "ready", state: { enabled: true, changedAt: at } });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/works/${documentId}/direct-edit`);
    expect(init?.method).toBe("GET");
  });

  it("šalje traženi način kroz work.direct-edit.put", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ outcome: "applied", mode: "suggestions", changedAt: at }));
    await expect(directEditPort({ baseUrl, fetchImpl }).write(documentId, false))
      .resolves.toEqual({ kind: "recorded", state: { enabled: false, changedAt: at } });
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ mode: "suggestions" });
  });

  it("B-6: promjena vrijedi tek kad odgovor poslužitelja navede novo stanje", async () => {
    // The server answers with the old mode: the change is not taken as done.
    const stale = directEditPort({ baseUrl, fetchImpl: async () => json({ outcome: "unchanged", mode: "direct", changedAt: at }) });
    await expect(changeDirectEdit(stale, documentId, false)).resolves.toEqual({ kind: "unknown" });
    // An answer outside the contract confirms nothing either.
    const odd = directEditPort({ baseUrl, fetchImpl: async () => json({ outcome: "applied", changedAt: at }) });
    await expect(changeDirectEdit(odd, documentId, false)).resolves.toEqual({ kind: "unknown" });
    // Only the server's naming of the new mode records it.
    const named = directEditPort({ baseUrl, fetchImpl: async () => json({ outcome: "applied", mode: "suggestions", changedAt: at }) });
    await expect(changeDirectEdit(named, documentId, false))
      .resolves.toEqual({ kind: "recorded", state: { enabled: false, changedAt: at } });
  });

  it("razlikuje istek sesije, odbijanje i nepoznat ishod", async () => {
    const answer = (status: number, code: string) => directEditPort({ baseUrl, fetchImpl: async () => json({ code }, status) });
    await expect(answer(401, "unauthorized").write(documentId, true)).resolves.toEqual({ kind: "signedOut" });
    await expect(answer(404, "not_found").write(documentId, true)).resolves.toEqual({ kind: "rejected" });
    await expect(answer(503, "unavailable").write(documentId, true)).resolves.toEqual({ kind: "unknown" });
    await expect(answer(401, "unauthorized").read(documentId)).resolves.toEqual({ kind: "signedOut" });
    await expect(answer(404, "not_found").read(documentId)).resolves.toEqual({ kind: "unavailable" });
  });

  it("prekinuta veza ne potvrđuje ništa", async () => {
    const offline = directEditPort({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } });
    await expect(offline.read(documentId)).resolves.toEqual({ kind: "unavailable" });
    await expect(offline.write(documentId, false)).resolves.toEqual({ kind: "unknown" });
  });
});
