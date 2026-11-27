// F4-PM2-R08 (D-50): the teacher's read of the accommodation mark, over a stand-in transport; invented data only.
import { describe, expect, it } from "vitest";

import { readStudentAccommodation, readStudentAccommodations, type AccommodationCall } from "./work-accommodation";

const A = "00000000-0000-4000-8000-0000000000a1";
const S1 = "00000000-0000-4000-8000-0000000000b1";
const S2 = "00000000-0000-4000-8000-0000000000b2";

function call(bodies: Record<string, unknown>, asked: string[] = []): AccommodationCall {
  return async (id, { params }) => {
    asked.push(`${id} ${params.assignmentId} ${params.studentId}`);
    const body = bodies[params.studentId];
    return body === undefined ? { ok: false, status: 503, code: "unavailable" } : { ok: true, status: 200, body };
  };
}

describe("teacher.student-accommodation.get (F4-PM2-R08)", () => {
  it("reads one student's mark for one assignment", async () => {
    const asked: string[] = [];
    expect(await readStudentAccommodation(call({ [S1]: { marked: true } }, asked), A, S1)).toBe(true);
    expect(await readStudentAccommodation(call({ [S1]: { marked: false } }), A, S1)).toBe(false);
    expect(asked).toEqual([`teacher.student-accommodation.get ${A} ${S1}`]);
  });

  it("a failed read, a thrown transport or an answer off the shape is null, never unmarked", async () => {
    expect(await readStudentAccommodation(call({}), A, S1)).toBeNull();
    expect(await readStudentAccommodation(async () => { throw new Error("mreža"); }, A, S1)).toBeNull();
    expect(await readStudentAccommodation(call({ [S1]: { marked: "da" } }), A, S1)).toBeNull();
    expect(await readStudentAccommodation(call({ [S1]: { marked: true, reason: "diktiranje" } }), A, S1)).toBeNull();
  });

  it("reads every student of the assignment, and one failure makes the whole assignment unavailable", async () => {
    const marks = await readStudentAccommodations(call({ [S1]: { marked: true }, [S2]: { marked: false } }), A, [S1, S2]);
    expect(marks === null ? null : [...marks]).toEqual([[S1, true], [S2, false]]);
    expect(await readStudentAccommodations(call({ [S1]: { marked: true } }), A, [S1, S2])).toBeNull();
  });
});
