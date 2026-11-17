// DAN-876: MyAssignments reads student.assignments.get through createApi()
// over the fake server from @ductura/test-fakes. The screen's tests run in the
// ui job, which has no test-fakes, over a copy of the route's vectors; this
// test keeps that copy equal to the package and runs each vector through the
// real client, so both halves meet in readMyAssignments.
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readMyAssignments, type AssignmentsCall, type MyAssignmentsRead } from "../components/student/my-assignments-read";
import { createApi } from "./api";

const ROUTE = "student.assignments.get";
const ROUTE_VECTORS = VECTORS.filter((v) => v.route === ROUTE);
const FIXTURE = new URL("../components/student/fixtures/student.assignments.get.json", import.meta.url);
const server = createFakeServer();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** createApi over the fake server, answering with the named vector; counts requests. */
function callFor(vector: FakeVector, sent: { count: number }): AssignmentsCall {
  return createApi({
    baseUrl,
    fetchImpl: (input, init) => {
      sent.count += 1;
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(vector.request.headers ?? {})) headers.set(name, value);
      headers.set(FAKE_VECTOR_HEADER, vector.name);
      return fetch(input, { ...init, headers });
    },
  });
}

const vector = (name: string) => ROUTE_VECTORS.find((v) => v.name === name) as FakeVector;
const answering = (response: () => Response): AssignmentsCall => createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: async () => response() });

describe("the copy of the route's vectors", () => {
  it("is exactly the package's vectors of the route, and there are only these four", () => {
    const copy = JSON.parse(readFileSync(FIXTURE, "utf8")) as { vectors: unknown };
    expect(copy).toEqual({ vectors: ROUTE_VECTORS });
    expect(ROUTE_VECTORS.map((v) => v.name)).toEqual(["ready", "ready-empty", "signed-out", "unavailable"]);
  });
});

describe("readMyAssignments through createApi over the fake server (DAN-876)", () => {
  const cases: [string, MyAssignmentsRead][] = [
    ["unavailable", { kind: "unavailable" }],
    ["signed-out", { kind: "signedOut" }],
    ["ready-empty", { kind: "ready", courses: [] }],
  ];
  for (const [name, read] of cases) {
    it(`${name}: one request, read ${read.kind}`, async () => {
      const sent = { count: 0 };
      expect(await readMyAssignments(callFor(vector(name), sent))).toEqual(read);
      expect(sent.count).toBe(1);
    });
  }

  it("ready: exactly the courses of the vector, in their order", async () => {
    const sent = { count: 0 };
    const body = vector("ready").response.body as { courses: unknown[] };
    expect(body.courses.length).toBeGreaterThan(0);
    expect(await readMyAssignments(callFor(vector("ready"), sent))).toEqual({ kind: "ready", courses: body.courses });
    expect(sent.count).toBe(1);
  });

  it("a broken connection, a 429, a 500 and a 200 outside the schema read unavailable, never an empty list", async () => {
    const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const calls: AssignmentsCall[] = [
      createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) }),
      answering(json(429, { error: "too_many_requests", code: "too_many_requests" })),
      answering(json(500, { error: "internal", code: "internal" })),
      answering(json(200, { courses: [], extra: true })),
      answering(json(200, { courses: [{ id: "x", name: "Izmišljeni", assignments: [] }] })),
      answering(() => new Response("{", { status: 200, headers: { "content-type": "application/json" } })),
    ];
    for (const call of calls) expect(await readMyAssignments(call)).toEqual({ kind: "unavailable" });
  });
});
