// #2028 (after DAN-871): readTeacherCourses and readMentoredWorks through the
// real createApi over the fake server of @ductura/test-fakes, every vector of
// teacher.courses.get and teacher.mentorships.get, so the screens' reads and
// the contract meet here.
import type { AddressInfo } from "node:net";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readMentoredWorks, type MentoredWorksCall } from "../components/teacher/mentored-works-read";
import { readTeacherCourses, type TeacherCoursesCall } from "../components/teacher/teacher-courses-read";
import { createApi } from "./api";

const server = createFakeServer();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** createApi over the fake server, answering with the vector; counts requests. */
function over(vector: FakeVector, sent: { count: number }) {
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

const KIND_BY_STATUS: Record<number, string> = { 200: "ready", 401: "signedOut", 403: "notTeacher" };
const vectorsOf = (route: string) => VECTORS.filter((v) => v.route === route);

describe("readTeacherCourses over every vector of teacher.courses.get", () => {
  const vectors = vectorsOf("teacher.courses.get");
  it("has vectors for 200, 401, 403 and the rest", () => {
    expect(new Set(vectors.map((v) => v.response.status))).toEqual(new Set([200, 401, 403, 404, 503]));
  });
  for (const vector of vectors) {
    it(`${vector.name}: one request, ${KIND_BY_STATUS[vector.response.status] ?? "unavailable"}`, async () => {
      const sent = { count: 0 };
      const read = await readTeacherCourses(over(vector, sent) as unknown as TeacherCoursesCall);
      expect(sent.count).toBe(1);
      expect(read.kind).toBe(KIND_BY_STATUS[vector.response.status] ?? "unavailable");
      if (read.kind === "ready") expect(read.courses).toEqual((vector.response.body as { courses: unknown[] }).courses);
    });
  }
});

describe("readMentoredWorks over every vector of teacher.mentorships.get", () => {
  const vectors = vectorsOf("teacher.mentorships.get");
  it("has vectors for 200, 401, 403 and the rest", () => {
    expect(new Set(vectors.map((v) => v.response.status))).toEqual(new Set([200, 401, 403, 503]));
  });
  for (const vector of vectors) {
    it(`${vector.name}: one request, ${KIND_BY_STATUS[vector.response.status] ?? "unavailable"}`, async () => {
      const sent = { count: 0 };
      const read = await readMentoredWorks(over(vector, sent) as unknown as MentoredWorksCall);
      expect(sent.count).toBe(1);
      expect(read.kind).toBe(KIND_BY_STATUS[vector.response.status] ?? "unavailable");
      if (read.kind === "ready") expect(read.works).toEqual((vector.response.body as { works: unknown[] }).works);
    });
  }
});

describe("a broken connection or an answer outside the schema", () => {
  const json = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  it("reads unavailable, never an empty list", async () => {
    const broken = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await readTeacherCourses(broken as unknown as TeacherCoursesCall)).toEqual({ kind: "unavailable" });
    expect(await readMentoredWorks(broken as unknown as MentoredWorksCall)).toEqual({ kind: "unavailable" });
    const wide = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: json(200, { courses: [], extra: 1 }) });
    expect(await readTeacherCourses(wide as unknown as TeacherCoursesCall)).toEqual({ kind: "unavailable" });
    const wrong = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: json(200, { works: [{ title: "x" }] }) });
    expect(await readMentoredWorks(wrong as unknown as MentoredWorksCall)).toEqual({ kind: "unavailable" });
  });
});
