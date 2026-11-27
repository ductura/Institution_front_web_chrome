// The client's reader against every vector of migration-contract-vectors.generated.json (ZEL-W19).
// When the server changes a contract, the extract and its vectors are regenerated and this file fails in
// CI before the merge, not in the app. For each vector with a JSON answer the reader (createApi in api.ts)
// must accept the valid answer, refuse a field of the wrong type and refuse an answer that lacks a required
// field. Every vector with an object answer must make at least one such negative check, or be listed in
// NO_MUTABLE_FIELDS below, so a field behind $ref/anyOf/oneOf is never skipped without a trace.
import { describe, expect, it } from "vitest";
import { createApi, RESPONSES, type ApiOperationId, type Input } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

const BASE_URL = "https://ductura.example.invalid";
type Vector = (typeof vectors)[number];
type Json = Record<string, unknown>;

function answering(status: number, body: unknown, contentType: string): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function inputOf(vector: Vector): Input<ApiOperationId> {
  const { params, query, body } = vector.request as { params?: unknown; query?: unknown; body?: unknown };
  return { params, query, body } as Input<ApiOperationId>;
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A value of another JSON type than the given one. */
function otherType(value: unknown): unknown {
  return typeof value === "string" ? 12345 : { wrong: true };
}

function schemaOf(vector: Vector): Json | undefined {
  const spec = RESPONSES.get(vector.route)?.[String(vector.response.status)];
  return spec?.content?.["application/json"]?.schema as Json | undefined;
}

/** Vectors (`route name`) whose answer has no field this test can mutate (fields behind $ref/anyOf/oneOf, or an empty object). */
// 69 answers are a top-level anyOf (no `properties` to mutate) and 2 have properties without a plain type/const.
const NO_MUTABLE_FIELDS = new Set<string>([
  "auth.webauthn-challenge.post assertion",
  "auth.webauthn-challenge.post registration",
  "collaboration.comments.post created",
  "collaboration.comments.post created-general",
  "collaboration.comments.post created-general-without-revision",
  "collaboration.comments.post listed",
  "collaboration.comments.post replied",
  "collaboration.revision-requests.post accepted-without-range",
  "collaboration.revision-requests.post applied",
  "collaboration.revision-requests.post created",
  "collaboration.revision-requests.post listed",
  "course.aggregate.get course-aggregate",
  "course.aggregate.get suppressed",
  "institution.teaching-team-view.get success-assistant",
  "institution.teaching-team-view.get success-holder",
  "live.document.get state",
  "live.document.get submitted",
  // mentorship.working-style.get (MEN-R09): the answer is anyOf (text or nulls), so no single properties list to mutate.
  "mentorship.working-style.get not-written",
  "mentorship.working-style.get written",
  "ops.events.get empty",
  "ops.events.get page",
  "profile.staff-affiliation.get confirmed",
  "profile.staff-affiliation.get missing",
  "public.verification.post match",
  "public.verification.post no-match",
  "student.assistant-request.post ai-disabled",
  "student.assistant-request.post budget-exceeded",
  "student.assistant-request.post completed",
  "student.assistant-request.post forbidden",
  "student.assistant-request.post idempotency-conflict",
  "student.assistant-request.post in-progress",
  "student.assistant-request.post provider-failed",
  "student.assistant-request.post purpose-not-allowed",
  "student.assistant-request.post request-outcome-unknown",
  "student.submission.get ceka",
  "student.submission.get none",
  "student.submission.get potvrdeno",
  // work-team (SRV#729): answers are a top-level anyOf discriminated by `state`.
  "student.work-team-contribution.get disabled",
  "student.work-team-contribution.get failed",
  "student.work-team-contribution.get none",
  "student.work-team-contribution.get pending",
  "student.work-team-contribution.get ready",
  "student.work-team.get disabled",
  "student.work-team.get member",
  "student.work-team.get none",
  "student.work-team.get none-teacher-forms",
  "student.work-team.post created",
  "student.work-team.post joined",
  "student.work-team.post left",
  "teacher.declaration-second.get bound-declaration",
  "teacher.declaration-second.get bound-with-conversation",
  "teacher.declaration-second.get no-live-submission",
  "teacher.declaration-third.get bound-declaration",
  "teacher.declaration-third.get bound-with-conversation",
  "teacher.declaration-third.get no-live-submission",
  "teacher.declaration.get bound-declaration",
  "teacher.declaration.get no-live-submission",
  "teacher.mentorship-request-decision.post approve",
  "teacher.mentorship-request-decision.post decline-with-reason",
  "teacher.mentorship-request-decision.post decline-without-reason",
  "teacher.merlin-package.get expired",
  "teacher.merlin-package.get failed",
  "teacher.merlin-package.get queued",
  "teacher.merlin-package.get ready",
  "teacher.submission-receipt.get ceka",
  "teacher.submission-receipt.get none",
  "teacher.submission-receipt.get potvrdeno",
  "teacher.work-team-contribution.get disabled",
  "teacher.work-team-contribution.get failed",
  "teacher.work-team-contribution.get none",
  "teacher.work-team-contribution.get pending",
  "teacher.work-team-contribution.get ready",
  "work.comment-drafts.post reply-created",
  "work.comment-drafts.post thread-created",
  "work.export-pdf.get ordinary",
  // work.restore.post (INT-21 C): recorded/already_recorded with a revision, or no_matching_revision alone.
  "work.restore.post already-recorded",
  "work.restore.post no-matching-revision",
  "work.restore.post recorded",
  "work.version.get diff",
  "work.version.get slides-snapshot",
  "work.version.get snapshot",
]);

/** The negative checks one object answer supports: fields with a plain type/const, and required fields present. */
function negativeChecks(vector: Vector, body: Json): { wrongType: string[]; missing: string[] } {
  const schema = schemaOf(vector);
  const properties = isObject(schema?.properties) ? schema.properties : {};
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
  return {
    wrongType: Object.keys(body).filter((key) => key in properties && isObject(properties[key]) && ("type" in properties[key] || "const" in properties[key])),
    missing: required.filter((key) => key in body),
  };
}

const multipart = (v: Vector) => (v.request as { headers?: Record<string, string> }).headers?.["content-type"]?.startsWith("multipart/") === true;
const successes = vectors.filter((v) => v.response.status < 400 && (v.response as { contentType?: string }).contentType?.startsWith("application/json") === true);

describe("client reader against the migration vectors", () => {
  it("has vectors to read", () => {
    expect(successes.length).toBeGreaterThan(0);
  });

  for (const vector of successes) {
    const id = vector.route as ApiOperationId;
    const { status, body } = vector.response;
    const contentType = (vector.response as { contentType?: string }).contentType ?? "application/json";
    const read = (answer: unknown) => createApi({ baseUrl: BASE_URL, fetchImpl: answering(status, answer, contentType) })(id, inputOf(vector));

    // A multipart upload (the source proof image) is no JSON body: this client does not send it, so there is no answer to read.
    if (multipart(vector)) {
      it(`${id} ${vector.name}: is a multipart upload the client refuses before sending`, async () => {
        expect(await read(body)).toEqual({ ok: false, status: 0, code: "client_rejected" });
      });
      continue;
    }

    it(`${id} ${vector.name}: accepts the valid answer`, async () => {
      expect(await read(body)).toEqual({ ok: true, status, body, headers: {} });
    });

    if (isObject(body)) {
      it(`${id} ${vector.name}: refuses a wrong type and a missing required field`, async () => {
        const { wrongType, missing } = negativeChecks(vector, body);
        const label = `${id} ${vector.name}`;
        if (NO_MUTABLE_FIELDS.has(label)) {
          expect(wrongType.length + missing.length, `${label} is listed as unmutable but has fields to mutate`).toBe(0);
          return;
        }
        expect(wrongType.length + missing.length, `${label} has no field to mutate: fix the vector or list it in NO_MUTABLE_FIELDS`).toBeGreaterThan(0);
        for (const key of wrongType) {
          expect(await read({ ...body, [key]: otherType(body[key]) }), `${key} of the wrong type`).toEqual({ ok: false, status, code: "unexpected" });
        }
        for (const key of missing) {
          const { [key]: _removed, ...rest } = body;
          expect(await read(rest), `${key} missing`).toEqual({ ok: false, status, code: "unexpected" });
        }
      });
    }
  }

  it("lists only vectors that exist in NO_MUTABLE_FIELDS", () => {
    const known = new Set(successes.map((v) => `${v.route} ${v.name}`));
    expect([...NO_MUTABLE_FIELDS].filter((label) => !known.has(label)), "stale NO_MUTABLE_FIELDS entries").toEqual([]);
  });

  it("refuses an answer that is not an object where the contract gives one", async () => {
    const objectVectors = successes.filter((v) => !multipart(v) && isObject(v.response.body) && schemaOf(v)?.type === "object");
    let count = 0;
    for (const vector of objectVectors) {
      count += 1;
      const { status } = vector.response;
      const contentType = (vector.response as { contentType?: string }).contentType ?? "application/json";
      const result = await createApi({ baseUrl: BASE_URL, fetchImpl: answering(status, "nope", contentType) })(vector.route as ApiOperationId, inputOf(vector));
      expect(result, `${vector.route} ${vector.name}`).toEqual({ ok: false, status, code: "unexpected" });
    }
    expect(count).toBeGreaterThan(0);
  });
});
