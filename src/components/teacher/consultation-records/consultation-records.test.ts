import { describe, expect, it, vi } from "vitest";

import {
  addConsultationNote, readConsultationList, readConsultations, readConsultationVersions, saveConsultation,
} from "../../../client/consultation-records";

const baseUrl = "https://ductura.example.invalid";
const work = "demo-rad";
const recordId = "00000000-0000-4000-8000-00000000001a";
const input = { heldOn: "2026-11-20", revision: 5, topic: "Izmišljena tema", agreement: "Dopuniti izmišljeni primjer." };
const record = { id: recordId, ...input, additions: [] };
const addition = { id: "00000000-0000-4000-8000-00000000001b", text: "Pokazati drugi primjer.", createdAt: "2026-11-20T12:05:00.000Z" };

describe("WEB-1109 consultation client", () => {
  it("reads an empty list and requests the older page of versions for the same work", async () => {
    const versions = { versions: [{ kind: "checkpoint", savedMinute: addition.createdAt, revision: 5 }], nextBeforeRevision: null };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ records: [] }))
      .mockResolvedValueOnce(Response.json(versions));
    const options = { baseUrl, fetchImpl };

    expect(await readConsultations(work, options)).toEqual([]);
    expect(await readConsultationVersions(work, 7, options)).toEqual(versions);
    expect(fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method, init?.body])).toEqual([
      [`${baseUrl}/api/v1/works/${work}/consultation-records`, "GET", undefined],
      [`${baseUrl}/api/v1/works/${work}/versions?beforeRevision=7`, "GET", undefined],
    ]);
  });

  it("tells 401, 403 and 404 apart from a read that can be tried again (N-11)", async () => {
    const answer = async (status: number) => readConsultationList(work, {
      baseUrl, fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "x" }, { status })),
    });
    expect((await answer(403)).kind).toBe("forbidden");
    expect((await answer(404)).kind).toBe("not-found");
    expect((await answer(503)).kind).toBe("unavailable");
    expect((await answer(401)).kind).toBe("unauthorized");
  });

  it("posts only the contract fields, then reads the stored addition with the record", async () => {
    const updated = { ...record, additions: [addition] };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(record, { status: 201 }))
      .mockResolvedValueOnce(Response.json(addition, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ records: [updated] }));
    const options = { baseUrl, fetchImpl };

    expect(await saveConsultation(work, input, options)).toEqual(record);
    expect(await addConsultationNote(work, recordId, addition.text, options)).toEqual(addition);
    expect(await readConsultations(work, options)).toEqual([updated]);
    expect(fetchImpl.mock.calls.slice(0, 2).map(([url, init]) => [String(url), init?.method, JSON.parse(String(init?.body))]))
      .toEqual([
        [`${baseUrl}/api/v1/works/${work}/consultation-records`, "POST", input],
        [`${baseUrl}/api/v1/works/${work}/consultation-records/${recordId}/additions`, "POST", { text: addition.text }],
      ]);
  });

  it("confirms neither a refused write, a wrong 2xx status, nor a network failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "invalid_input" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json(record, { status: 200 }))
      .mockRejectedValueOnce(new TypeError("offline"));
    const options = { baseUrl, fetchImpl };

    expect(await saveConsultation(work, input, options)).toBeNull();
    expect(await saveConsultation(work, input, options)).toBeNull();
    expect(await addConsultationNote(work, recordId, addition.text, options)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
