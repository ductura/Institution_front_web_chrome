import { describe, expect, it, vi } from "vitest";

import { citationStyleOf } from "./catalog";
import { readInstitutionStyle } from "./use-institution-style";

const ID = "4b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01";
const reply = (status: number, body: unknown) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, body }));
const config = (citationStyle?: unknown) => ({ enabledCheckIds: [], lektaProfileId: null, ...(citationStyle === undefined ? {} : { citationStyle }) });

describe("readInstitutionStyle", () => {
  it("asks for the assignment only: the style comes from the session, no institution is sent", async () => {
    const call = reply(200, config("ieee"));
    const out = await readInstitutionStyle(call, ID);
    expect(call).toHaveBeenCalledWith("student.text-check-config.get", { params: { assignmentId: ID }, query: undefined, body: undefined });
    expect(out).toEqual({ kind: "style", id: "ieee", style: citationStyleOf("ieee") });
  });

  it("returns each available style of the institution", async () => {
    for (const id of ["fpzg", "apa", "chicago", "ieee", "vancouver"]) {
      const out = await readInstitutionStyle(reply(200, config(id)), ID);
      expect(out.kind === "style" && out.id).toBe(id);
    }
  });

  it("falls back to FPZG, marked as not available, for fusnote, an unknown id and a missing field", async () => {
    for (const value of ["fusnote", "mla", 7, null, undefined]) {
      const out = await readInstitutionStyle(reply(200, config(value)), ID);
      expect(out, String(value)).toEqual({ kind: "fallback", id: "fpzg", style: citationStyleOf("fpzg") });
    }
  });

  it("keeps a failed read apart from every style outcome (503 is not empty)", async () => {
    for (const [status, body] of [[503, { error: "unavailable" }], [404, { error: "not_found" }], [401, { error: "unauthorized" }], [500, {}]] as const) {
      expect((await readInstitutionStyle(reply(status, body), ID)).kind, String(status)).toBe("error");
    }
  });

  it("treats a thrown call, an empty answer and a non-object body as an error", async () => {
    expect((await readInstitutionStyle(vi.fn(async () => { throw new Error("offline"); }), ID)).kind).toBe("error");
    expect((await readInstitutionStyle(reply(200, undefined), ID)).kind).toBe("error");
    expect((await readInstitutionStyle(reply(200, null), ID)).kind).toBe("error");
    expect((await readInstitutionStyle(reply(200, "ieee"), ID)).kind).toBe("error");
  });

  it("answers 200 with 204-like ok but wrong status as an error", async () => {
    expect((await readInstitutionStyle(vi.fn(async () => ({ ok: true, status: 204 })), ID)).kind).toBe("error");
  });
});
