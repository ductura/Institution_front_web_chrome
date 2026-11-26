import { expect, it, vi } from "vitest";
import { createSourceNote, deleteSourceNote, updateSourceNote } from "./source-notebook";

const sourceId = "0b9a8c52-3f4e-4d1a-8c3b-6a1f2e9d7c10";
const noteId = "5d2c7e11-9a3b-4f6d-9b2e-1c8a4f7e3d20";
const note = { id: noteId, quote: "Izmišljeni citat", page: "14", note: null };
const base = { baseUrl: "https://ductura.invalid" };

it("creates a note with blank fields sent as null and refuses an empty draft without a request", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(note, { status: 201 }));
  expect(await createSourceNote("doc-vrt", sourceId, { quote: "Izmišljeni citat", page: "14", note: "  " }, { ...base, fetchImpl }))
    .toEqual({ kind: "ok", note });
  const [url, init] = fetchImpl.mock.calls[0]!;
  expect(String(url)).toBe(`https://ductura.invalid/api/v1/works/doc-vrt/sources/${sourceId}/notes`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ quote: "Izmišljeni citat", page: "14", note: null });
  fetchImpl.mockClear();
  expect(await createSourceNote("doc-vrt", sourceId, { quote: " ", note: "" }, { ...base, fetchImpl })).toEqual({ kind: "invalid" });
  expect(await createSourceNote("doc-vrt", "nije-uuid", { note: "x" }, { ...base, fetchImpl })).toEqual({ kind: "invalid" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("maps 401, 404, 422 and an unexpected answer on create and update", async () => {
  const answer = (status: number, code: string) =>
    vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code }, { status }));
  const draft = { note: "Izmišljena bilješka" };
  expect(await createSourceNote("d", sourceId, draft, { ...base, fetchImpl: answer(401, "unauthorized") })).toEqual({ kind: "signedOut" });
  expect(await createSourceNote("d", sourceId, draft, { ...base, fetchImpl: answer(404, "not_found") })).toEqual({ kind: "notFound" });
  expect(await updateSourceNote("d", sourceId, noteId, draft, { ...base, fetchImpl: answer(404, "not_found") })).toEqual({ kind: "notFound" });
  expect(await updateSourceNote("d", sourceId, noteId, draft, { ...base, fetchImpl: answer(422, "invalid_input") })).toEqual({ kind: "invalid" });
  expect(await updateSourceNote("d", sourceId, noteId, draft, { ...base, fetchImpl: answer(503, "unavailable") })).toEqual({ kind: "unavailable" });
  expect(await createSourceNote("d", sourceId, draft, { ...base, fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error("x")) })).toEqual({ kind: "unavailable" });
});

it("updates by note ID in the body and deletes by note ID in the query", async () => {
  const patch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(note));
  expect(await updateSourceNote("d", sourceId, noteId, { quote: "Izmišljeni citat", page: "14" }, { ...base, fetchImpl: patch }))
    .toEqual({ kind: "ok", note });
  expect(patch.mock.calls[0]![1]?.method).toBe("PATCH");
  expect(JSON.parse(String(patch.mock.calls[0]![1]?.body))).toEqual({ noteId, quote: "Izmišljeni citat", page: "14", note: null });
  const del = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  expect(await deleteSourceNote("d", sourceId, noteId, { ...base, fetchImpl: del })).toEqual({ kind: "ok" });
  expect(String(del.mock.calls[0]![0])).toBe(`https://ductura.invalid/api/v1/works/d/sources/${sourceId}/notes?noteId=${noteId}`);
  expect(del.mock.calls[0]![1]?.method).toBe("DELETE");
  const gone = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: "not_found" }, { status: 404 }));
  expect(await deleteSourceNote("d", sourceId, noteId, { ...base, fetchImpl: gone })).toEqual({ kind: "notFound" });
});
