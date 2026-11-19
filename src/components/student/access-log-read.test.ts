import { describe, expect, it } from "vitest";

import type { createApi } from "@/client/api";

import { assignmentIdOf, cursorOf, pageHref, readAccessLogPage } from "./access-log-read";

// WEB-13 (S-42 over /api/v1). Invented ids and names only.
type Api = ReturnType<typeof createApi>;
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const DOCUMENT = "izmisljeni-rad-0001";
const ENTRY = {
  id: "00000000-0000-4000-8000-000000000001",
  at: "2026-11-10T13:10:00.000Z",
  role: "teacher",
  surface: "live_view",
  reader: { givenName: "Izmišljena", familyName: "Nastavnica" },
};

type Call = { id: string; input: unknown };

function fake(answer: (id: string, input: unknown) => unknown, calls: Call[] = []): Api {
  return (async (id: string, input: unknown) => {
    calls.push({ id, input });
    return answer(id, input);
  }) as unknown as Api;
}

const fail = (status: number, code: string) => fake(() => ({ ok: false, status, code }));
const page = (body: object) => fake(() => ({ ok: true, status: 200, body }));

describe("readAccessLogPage", () => {
  it("reads the page of the cursor for the work and groups it into days", async () => {
    const calls: Call[] = [];
    const cursor = { beforeAt: "2026-11-10T13:10:00.000Z", beforeId: ENTRY.id };
    const result = await readAccessLogPage(
      fake(() => ({ ok: true, status: 200, body: { entries: [ENTRY], next: null, continued: true } }), calls),
      DOCUMENT,
      cursor,
    );
    expect(calls).toEqual([{ id: "student.access-log.get", input: { params: { documentId: DOCUMENT }, query: cursor, body: undefined } }]);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.continued).toBe(true);
    expect(result.next).toBeNull();
    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.entries[0]?.from).toBe("14:10");
  });

  it("reads the first page with an empty query when there is no cursor", async () => {
    const calls: Call[] = [];
    await readAccessLogPage(fake(() => ({ ok: true, status: 200, body: { entries: [], next: null, continued: false } }), calls), DOCUMENT, null);
    expect(calls[0]?.input).toEqual({ params: { documentId: DOCUMENT }, query: {}, body: undefined });
  });

  it.each([
    [401, "unauthorized", "signedOut"],
    [401, "session_expired", "signedOut"],
    [403, "forbidden", "notFound"],
    [404, "not_found", "notFound"],
    [503, "unavailable", "unavailable"],
    [0, "client_rejected", "unavailable"],
    [200, "unexpected", "unavailable"],
  ])("%i %s reads %s", async (status, code, kind) => {
    expect(await readAccessLogPage(fail(status, code), DOCUMENT, null)).toEqual({ kind });
  });

  it("keeps the next cursor of the page", async () => {
    const next = { beforeAt: "2026-11-10T13:10:00.000Z", beforeId: ENTRY.id };
    const result = await readAccessLogPage(page({ entries: [ENTRY], next, continued: false }), DOCUMENT, null);
    expect(result).toMatchObject({ kind: "ok", next, continued: false });
  });
});

describe("address helpers", () => {
  it("takes only a UUID as the assignment, in lower case", () => {
    expect(assignmentIdOf(ASSIGNMENT.toUpperCase())).toBe(ASSIGNMENT);
    expect(assignmentIdOf("nije-uuid")).toBeNull();
    expect(assignmentIdOf("%E0%A4%A")).toBeNull();
  });

  it("takes the cursor only when both parts are single strings", () => {
    expect(cursorOf({ prije: "a", zapis: "b" })).toEqual({ beforeAt: "a", beforeId: "b" });
    expect(cursorOf({ prije: "a" })).toBeNull();
    expect(cursorOf({ prije: ["a", "b"], zapis: "c" })).toBeNull();
  });

  it("writes the cursor back into the address", () => {
    const here = `/rad/${ASSIGNMENT}/dnevnik-pristupa`;
    expect(pageHref(here, null)).toBe(here);
    expect(pageHref(here, { beforeAt: "2026-11-10T13:10:00.000Z", beforeId: ENTRY.id })).toBe(
      `${here}?prije=2026-11-10T13%3A10%3A00.000Z&zapis=${ENTRY.id}`,
    );
  });
});
