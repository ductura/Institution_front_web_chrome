// The shape of Ductus src/components/student/my-assignments-read.ts at 078c780f
// (DAN-753): the types only. The read itself is a server route that is not in
// the contract yet (S-1D, orkestrator c.6905045641 t. 4); the page passes it in.

export type MyAssignment = {
  id: string;
  title: string;
  dueAt: string;
  /** The current version's notice is not acknowledged yet; /rad opens it first. */
  noticeFirst: boolean;
};

export type MyCourse = { id: string; name: string; assignments: MyAssignment[] };

export type MyAssignmentsRead =
  | { kind: "ready"; courses: MyCourse[] }
  | { kind: "signedOut" }
  | { kind: "unavailable" };
