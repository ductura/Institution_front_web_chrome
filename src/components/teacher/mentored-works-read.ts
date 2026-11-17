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
