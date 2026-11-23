// INT-12 (N05, DAN-887): the registry of the client's hand-written domain parsers against the contract vectors.
// contract-reader.test.ts (ZEL-W19) holds createApi to every vector; a domain parser reads a body after that and
// adds rules of its own (a real calendar minute, one evidence domain, base64 that encodes back). Those rules were
// written by hand and once refused what the server really sends (#424, #437), so every 2xx vector of a route in
// the registry goes through its parser here, and a parser that refuses one fails this test before the merge.
// A route that leaves the extract, or a vector name the registry names that no longer exists, also fails, so the
// registry cannot go quiet. Invented data only: the bodies are the generated vectors.
import { describe, expect, it } from "vitest";

import { parseSession, RESPONSES } from "./api";
import { threadsFromList } from "./comments";
import { commitOutcomeFrom, openedWorkFrom } from "./evidence-ingest";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { parseReplayPage } from "./replay";
import { requestsFromList } from "./revision-requests";
import { readSubmittedVersion, readTeacherSubmissions, type SubmissionsCall } from "./teacher-submissions";

type Vector = {
  readonly route: string;
  readonly name: string;
  readonly request: { readonly headers?: Readonly<Record<string, string>>; readonly params?: Readonly<Record<string, string>>; readonly body?: unknown };
  readonly response: { readonly status: number; readonly contentType?: string; readonly body?: unknown };
};

/** A parser of one route: true when it reads the vector's body as the answer it is. */
type Entry = {
  /** Only the vectors this parser is given in the app (e.g. one action of a POST that serves several); all 2xx by default. */
  readonly covers?: (vector: Vector) => boolean;
  readonly reads: (vector: Vector) => boolean | Promise<boolean>;
};

const action = (name: string) => (vector: Vector) => vector.request.params?.action === name;
const answering = (vector: Vector): SubmissionsCall => async () => ({ ok: true, status: vector.response.status, body: vector.response.body });

/** Every domain parser over a response body, by route. A new hand-written parser gets a row here. */
const PARSERS: Readonly<Record<string, Entry>> = {
  "evidence.open.post": { reads: (v) => openedWorkFrom(v.response.body) !== null },
  "evidence.commit.post": {
    reads: (v) => {
      const protocol = v.request.headers?.["ductus-protocol"] === "2" ? "2" : "1";
      const outcome = commitOutcomeFrom(v.response.status, v.response.body, protocol);
      return outcome.status === "committed" || outcome.status === "duplicate";
    },
  },
  // Only a first page is in the vectors: no pin yet.
  "evidence.replay.post": { reads: (v) => parseReplayPage(v.response.body, (v.request.body as { from: number }).from, null) !== null },
  "collaboration.comments.post": { covers: action("list"), reads: (v) => threadsFromList(v.response.body) !== null },
  "collaboration.revision-requests.post": { covers: action("list"), reads: (v) => requestsFromList(v.response.body) !== null },
  "teacher.submissions.get": {
    reads: async (v) => (await readTeacherSubmissions(answering(v), v.request.params?.assignmentId ?? "")).kind === "ready",
  },
  "teacher.submission-detail.get": {
    reads: async (v) => {
      const { assignmentId = "", studentId = "" } = v.request.params ?? {};
      return (await readSubmittedVersion(answering(v), assignmentId, studentId)).kind === "ready";
    },
  },
  "profile.me.get": { reads: (v) => parseSession(v.response.body) !== null },
};

const all = vectors as readonly Vector[];
const isSuccess = (vector: Vector) => vector.response.status >= 200 && vector.response.status < 300;
const covered = (route: string, entry: Entry) =>
  all.filter((v) => v.route === route && isSuccess(v) && v.response.body !== undefined && (entry.covers?.(v) ?? true));
const withBody = (vector: Vector, body: unknown): Vector => ({ ...vector, response: { ...vector.response, body } });
const reads = (route: string, vector: Vector): boolean | Promise<boolean> => {
  const entry = PARSERS[route];
  if (entry === undefined) throw new Error(`no parser for ${route}`);
  return entry.reads(vector);
};

describe("domain parsers against the contract vectors (INT-12)", () => {
  for (const [route, entry] of Object.entries(PARSERS)) {
    it(`${route}: is in the extract and has a 2xx vector for its parser`, () => {
      expect(RESPONSES.has(route), `${route} is not in the contract`).toBe(true);
      expect(covered(route, entry).length, `${route} has no 2xx vector`).toBeGreaterThan(0);
    });

    for (const vector of covered(route, entry)) {
      it(`${route} ${vector.name}: the parser reads the ${vector.response.status} vector`, async () => {
        expect(await entry.reads(vector)).toBe(true);
      });
    }
  }

  it("every parser refuses a body that is no answer at all", async () => {
    for (const [route, entry] of Object.entries(PARSERS)) {
      for (const vector of covered(route, entry).slice(0, 1)) {
        expect(await entry.reads(withBody(vector, "nope")), route).toBe(false);
      }
    }
  });
});

// The two parsers that kept local copies of the contract (N05) now read its shape from RESPONSES: what the
// contract refuses they refuse, and what only they add (a real minute, one evidence domain) still holds.
describe("parsers read the shape from the contract (INT-12)", () => {
  const first = (route: string, name: string): Vector => {
    const found = all.find((v) => v.route === route && v.name === name);
    if (found === undefined) throw new Error(`no vector ${route} ${name}`);
    return found;
  };

  it("teacher.submissions.get: a documentId the contract refuses is not read", async () => {
    const vector = first("teacher.submissions.get", "submissions");
    const [row, ...rest] = (vector.response.body as { submissions: Record<string, unknown>[] }).submissions;
    for (const documentId of [" izmisljeni-rad-0001", "izmisljeni-rad-0001 ", "x".repeat(257)]) {
      expect(await reads("teacher.submissions.get", withBody(vector, { submissions: [{ ...row, documentId }, ...rest] })), documentId).toBe(false);
    }
  });

  it("teacher.submissions.get: a minute of the contract's shape that is no calendar minute is not read", async () => {
    const vector = first("teacher.submissions.get", "submissions");
    const [row, ...rest] = (vector.response.body as { submissions: Record<string, unknown>[] }).submissions;
    const body = { submissions: [{ ...row, requestedMinute: "2026-02-30T21:30:00.000Z" }, ...rest] };
    expect(await reads("teacher.submissions.get", withBody(vector, body))).toBe(false);
  });

  it("teacher.submission-detail.get: a field the contract does not name is not read", async () => {
    const vector = first("teacher.submission-detail.get", "submitted-version");
    const body = { ...(vector.response.body as object), submissionId: "izmisljeni-0001" };
    expect(await reads("teacher.submission-detail.get", withBody(vector, body))).toBe(false);
  });

  it("evidence.open.post: a receipt key outside the contract's shape is not read", () => {
    const vector = first("evidence.open.post", "opened");
    const body = vector.response.body as { receiptKeys: Record<string, unknown>[] };
    const [key] = body.receiptKeys;
    for (const changed of [{ ...key, extra: true }, { ...key, evidenceDomainId: "nije-uuid" }, { ...key, algorithm: "HS256" }]) {
      expect(openedWorkFrom({ ...body, receiptKeys: [changed] }), JSON.stringify(changed).slice(0, 80)).toBeNull();
    }
  });

  it("evidence.open.post: a schemaVersion outside the contract and keys of two domains are not read", () => {
    const body = first("evidence.open.post", "opened").response.body as { receiptKeys: Record<string, unknown>[] };
    expect(openedWorkFrom({ ...body, schemaVersion: 4 })).toBeNull();
    const [key] = body.receiptKeys;
    const other = { ...key, keyId: "izmisljeni-kljuc-2", evidenceDomainId: "0f1e2d3c-4b5a-4968-8776-655443322110" };
    expect(openedWorkFrom({ ...body, receiptKeys: [key, other] })).toBeNull();
  });
});
