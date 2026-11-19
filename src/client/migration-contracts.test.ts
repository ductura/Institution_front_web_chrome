import { describe, expect, it, vi } from "vitest";
import { createApi, type ApiOperationId, type Input } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

const BASE_URL = "https://ductura.example.invalid";
type Vector = (typeof vectors)[number];

function responding(vector: Vector, body: unknown = vector.response.body) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status: vector.response.status,
      headers: { "content-type": vector.response.contentType },
    }));
}

function inputFor(vector: Vector) {
  return { params: vector.request.params, query: undefined, body: vector.request.body } as Input<ApiOperationId>;
}

describe("WEB-07 temporary API contracts", () => {
  for (const vector of vectors) {
    const id = vector.route as ApiOperationId;

    it(`${id} ${vector.name} reads the canonical response`, async () => {
      const fetchImpl = responding(vector);
      const api = createApi({ baseUrl: BASE_URL, fetchImpl });
      const { status, body } = vector.response;
      const result = await api(id, inputFor(vector));

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      if (status < 400) expect(result).toEqual({ ok: true, status, body, headers: {} });
      else expect(result).toEqual({ ok: false, status, code: vector.name.replaceAll("-", "_") });
    });

    if (vector.response.status < 400) {
      it(`${id} ${vector.name} rejects undeclared response fields`, async () => {
        const fetchImpl = responding(vector, { ...vector.response.body, unexpectedField: true });
        const api = createApi({ baseUrl: BASE_URL, fetchImpl });
        expect(await api(id, inputFor(vector))).toEqual({ ok: false, status: vector.response.status, code: "unexpected" });
      });
    }
  }

  it("rejects extra fields inside student assignments", async () => {
    const vector = vectors.find((item) => item.route === "student.assignments.get" && item.name === "ready")!;
    const body = structuredClone(vector.response.body) as { courses: { assignments: Record<string, unknown>[] }[] };
    body.courses[0]!.assignments[0]!.unexpectedField = true;
    const api = createApi({ baseUrl: BASE_URL, fetchImpl: responding(vector, body) });
    expect(await api("student.assignments.get", { params: undefined, query: undefined, body: undefined }))
      .toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("rejects unknown enrollment fields before sending", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const api = createApi({ baseUrl: BASE_URL, fetchImpl });
    const body = { code: "IZMISLJENI-KOD-0001", unexpectedField: true };
    const result = await api("student.enrollments.post", { params: undefined, query: undefined, body });
    expect(result).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the assignment request key in the closed JSON body on the course route", async () => {
    const vector = vectors.find((item) => item.route === "institution.course-assignments.post" && item.name === "created")!;
    const fetchImpl = responding(vector);
    const api = createApi({ baseUrl: BASE_URL, fetchImpl });
    await api("institution.course-assignments.post", inputFor(vector) as Input<"institution.course-assignments.post">);

    const [url, init] = fetchImpl.mock.calls[0]!;
    const { params, body } = vector.request;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/institution/courses/${params?.courseId}/assignments`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });
});
