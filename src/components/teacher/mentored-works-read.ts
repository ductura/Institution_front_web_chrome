// The shape of Ductus src/server/institution/mentored-works.ts at 9c45857
// (DAN-871, 871-2): the types only, as the contract's teacher.mentorships.get
// gives a work. The read itself comes through src/client in 871-3.

export type MentoredWorkType = "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis";
export type MentoredWorkState = "not_started" | "in_progress" | "submitted";

export interface MentoredWork {
  mentorshipId: string;
  assignmentId: string;
  /** Null until the student starts the work. */
  documentId: string | null;
  /** Null when the account has no name pair (#757 D1); never a stand-in. */
  student: { givenName: string; familyName: string } | null;
  title: string;
  workType: MentoredWorkType;
  workState: MentoredWorkState;
}

export type MentoredWorksRead =
  | { kind: "ready"; works: MentoredWork[] }
  | { kind: "signedOut" }
  | { kind: "notTeacher" }
  | { kind: "unavailable" };

/** What the page needs of createApi(): teacher.mentorships.get, its answers only. */
export type MentoredWorksCall = (
  id: "teacher.mentorships.get",
  input: { params: undefined; query: undefined; body: undefined },
) => Promise<{ ok: true; status: 200; body: { works: MentoredWork[] } } | { ok: false; status: number; code: string }>;

/**
 * One call of teacher.mentorships.get (#2028, after 871-3): 200 the works as
 * they came, 401 signed out, 403 not a teacher, everything else unavailable.
 */
export async function readMentoredWorks(call: MentoredWorksCall): Promise<MentoredWorksRead> {
  try {
    const result = await call("teacher.mentorships.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready", works: result.body.works };
    if (result.status === 401) return { kind: "signedOut" };
    return result.status === 403 ? { kind: "notTeacher" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
