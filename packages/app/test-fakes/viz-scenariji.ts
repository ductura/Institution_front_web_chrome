// VIZ-PODACI (viz-scenarij-puno): the scenarios of the fake institution server
// for the VIZ tool (e2e/viz), so the app and its prototype are compared on the
// same data and the panels never show an error state by accident. Pure: no
// Playwright, no network; e2e/viz/otvori.ts wires it to a page.
// Invented people, courses and texts only. The "puno" data is the state "puno"
// of the prototype (docs/prototip/Ductura_student.html and Ductura_nastavnik.html:
// Student A, Kolegij A, B and C, the tasks t1 to t3, today 5. 11. 2026.).
export const SCENARIJI = ["puno", "prazno", "ucitavanje", "greska", "dugi-tekst"] as const;
export type Scenarij = (typeof SCENARIJI)[number];
export type VizRole = "student" | "teacher" | "institution_admin" | "network_engineer" | null;

/** The prototype's "today" (5. 11. 2026.), fixed in the page clock so shots are stable. */
// 23:59 is the hour of the deadline of t1, so "Rok za 3 dana" reads as in the prototype.
export const FIKSNI_DATUM = "2026-11-05T23:59:00+01:00";

export const imeScenarija = (value: string | undefined): Scenarij => {
  const name = value === undefined || value === "" ? "puno" : value;
  if ((SCENARIJI as readonly string[]).includes(name)) return name as Scenarij;
  throw new Error(`VIZ_SCENARIJ "${name}" nije poznat; dopušteno: ${SCENARIJI.join(", ")}`);
};

export type Answer = { readonly status: number; readonly contentType?: string; readonly body?: string };
/** "hang": the request is never answered (the loading state stays on screen). */
export type Result = Answer | "hang";

// Ids of the e2e suite (e2e/a11y/fake-server.ts), so the paths of the screen list open the same work.
export const COURSE_A = "0b9f6c1e-1d2a-4c3b-8e4f-5a6b7c8d9e01";
export const COURSE_B = "0b9f6c1e-1d2a-4c3b-8e4f-5a6b7c8d9e02";
export const COURSE_C = "0b9f6c1e-1d2a-4c3b-8e4f-5a6b7c8d9e03";
export const T1 = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
export const T2 = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02";
export const T3 = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03";

const LONG = "Vrlo dugi naslov koji se mora prelomiti u više redaka: čitanje, pisanje i đački šaputavci u šumi škrtih žaba, ćudljivi ždrijebac šuti";

type Names = { course: (k: "A" | "B" | "C") => string; title: (n: 1 | 2 | 3) => string; student: string; institution: string };
const SHORT: Names = {
  course: (k) => `Kolegij ${k}`,
  title: (n) => ["Lokalni mediji i izborna kampanja", "Javna rasprava o školskom kurikulu", "Esej o povjerenju u institucije"][n - 1]!,
  student: "Student A",
  institution: "Izmišljeni fakultet",
};
const LONGER: Names = {
  course: (k) => `Kolegij ${k}: ${LONG}`,
  title: (n) => `${LONG} (${n})`,
  student: "Studentica Ðurđica Šćepanović-Žigmundić Čakovečko-Međimurska",
  institution: `Izmišljeni fakultet za čitanje, pisanje i đačke šaputavce ${LONG.slice(0, 40)}`,
};

const iso = (local: string) => new Date(local).toISOString();

function studentData(n: Names) {
  return {
    "student.assignments.get": { courses: [
      { id: COURSE_A, name: n.course("A"), assignments: [{ id: T1, title: n.title(1), dueAt: iso("2026-11-08T23:59:00+01:00"), noticeFirst: false }] },
      { id: COURSE_B, name: n.course("B"), assignments: [{ id: T2, title: n.title(2), dueAt: iso("2027-01-15T23:59:00+01:00"), noticeFirst: true }] },
      { id: COURSE_C, name: n.course("C"), assignments: [{ id: T3, title: n.title(3), dueAt: iso("2026-10-01T23:59:00+02:00"), noticeFirst: false }] },
    ] },
    "student.assignment-work.get": { assignments: [
      { assignmentId: T1, workState: "in_progress" },
      { assignmentId: T2, workState: "not_started" },
      { assignmentId: T3, workState: "submitted" },
    ] },
    "student-work.works.get": { works: [
      { workId: "00000000-0000-4000-8000-0000000014c1", assignmentId: T1, assignmentTitle: n.title(1), courseId: COURSE_A, courseName: n.course("A"),
        academicYear: "2026/2027", dueAt: iso("2026-11-08T23:59:00+01:00"), state: "in_progress", revision: 3, submittedAt: null, language: "hr" },
      { workId: "00000000-0000-4000-8000-0000000014c3", assignmentId: T3, assignmentTitle: n.title(3), courseId: COURSE_C, courseName: n.course("C"),
        academicYear: "2026/2027", dueAt: iso("2026-10-01T23:59:00+02:00"), state: "submitted", revision: 12, submittedAt: iso("2026-10-03T14:20:00+02:00"), language: "hr" },
    ] },
  };
}

function teacherData(n: Names) {
  return {
    "teacher.courses.get": { courses: [
      { id: "2c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e01", name: n.course("A"), academicYear: "2026/2027", aiPolicy: "partially_allowed", assignments: [
        { id: T1, title: n.title(1), workType: "seminar_paper", opensAt: iso("2026-10-01T08:00:00+02:00"), dueAt: iso("2026-11-08T23:59:00+01:00"), currentVersion: 1, enrolledStudents: 24 },
      ] },
      { id: "2c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e02", name: n.course("B"), academicYear: "2026/2027", aiPolicy: "prohibited", assignments: [
        { id: T2, title: n.title(2), workType: "essay", opensAt: iso("2026-11-02T08:00:00+01:00"), dueAt: iso("2027-01-15T23:59:00+01:00"), currentVersion: 1, enrolledStudents: 18 },
      ] },
    ] },
    "teacher.mentorships.get": { works: [
      { mentorshipId: "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2901", assignmentId: T1, documentId: "izmisljeni-rad-0001",
        student: { givenName: "Student", familyName: "A" }, title: n.title(1), workType: "master_thesis", workState: "in_progress" },
      { mentorshipId: "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2902", assignmentId: T3, documentId: "izmisljeni-rad-0003",
        student: { givenName: "Student", familyName: "C" }, title: n.title(3), workType: "bachelor_thesis", workState: "submitted" },
    ] },
  };
}

const EMPTY: Record<string, unknown> = {
  "student.assignments.get": { courses: [] },
  "student.assignment-work.get": { assignments: [] },
  "teacher.courses.get": { courses: [] },
  "teacher.mentorships.get": { works: [] },
  "student-work.works.get": { works: [] },
  "institution.origin-thresholds.get": { thresholds: [] },
};

const STATUS = { checkedAt: "2026-11-05T08:00:00Z", components: { writing: "radi", submission: "radi", mentorView: "nije_ukljuceno" } };

/** Overrides of a scenario by contract operation: what its data is made of. */
export function podaci(scenarij: Scenarij): Record<string, unknown> {
  if (scenarij === "prazno") return EMPTY;
  const n = scenarij === "dugi-tekst" ? LONGER : SHORT;
  return { ...studentData(n), ...teacherData(n) };
}

/**
 * Contract vectors the screens read more from than the vector says: the
 * assignment's rhythm switch names where its state comes from (`source`), which
 * the vector of the assignment route lacks, so its card would show "unavailable".
 */
const DOPUNA: Readonly<Record<string, (body: Record<string, unknown>) => Record<string, unknown>>> = {
  "teacher.input-rhythm.get": (body) => ({ source: "course", ...body }),
};

/** A copy of `value` in which every field named in `ids`, at any depth, holds that id. */
export function sameIds(value: unknown, ids: Readonly<Record<string, string>>): unknown {
  if (Array.isArray(value)) return value.map((item) => sameIds(item, ids));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key in ids && typeof item === "string" ? ids[key] : sameIds(item, ids)]));
}

export type Contract = Record<string, { path: string; method: string; responses?: Record<string, unknown> }>;
export type Vector = { route: string; name: string; response?: { status: number; body?: unknown; contentType?: string } };

const size = (v: Vector) => JSON.stringify(v.response?.body ?? null).length;

/**
 * The fake server of a scenario. Operations the scenario does not name answer
 * with one of the contract's own successful vectors: the fullest for "puno" and
 * "dugi-tekst", the emptiest for "prazno". A request outside the contract is a
 * 404, as on the real server.
 */
/**
 * The vector a route answers with when the fullest one is not a work a screen can show: the
 * fullest evidence.open.post carries a footnote node, which the submission step refuses as text.
 */
const VEKTOR: Readonly<Record<string, string>> = {
  "evidence.open.post": "opened-after-commit",
};

export function vizServer(contract: Contract, vectors: readonly Vector[], scenarij: Scenarij) {
  const routes = Object.entries(contract).map(([operation, { path, method, responses }]) => {
    const names = (path.match(/\{[^}]+\}/g) ?? []).map((p) => p.slice(1, -1));
    const params = names.length;
    const pattern = new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`);
    const ok = vectors.filter((v) => v.route === operation && v.response !== undefined && v.response.status >= 200 && v.response.status < 300);
    const chosen = scenarij === "prazno" ? undefined : ok.find((v) => v.name === VEKTOR[operation]);
    const ranked = chosen !== undefined ? [chosen] : [...ok].sort((a, b) => (scenarij === "prazno" ? size(a) - size(b) : size(b) - size(a)));
    const capture = new RegExp(pattern.source.replaceAll("[^/]+", "([^/]+)"));
    return { operation, method: method.toUpperCase(), pattern, capture, names, params, vector: ranked[0], has204: responses !== undefined && "204" in responses };
  }).sort((a, b) => a.params - b.params);
  const own = podaci(scenarij);
  const json = (body: unknown, status = 200): Answer => ({ status, contentType: "application/json", body: JSON.stringify(body) });

  return {
    answer(role: VizRole, method: string, pathname: string): Result {
      const route = routes.find((r) => r.method === method.toUpperCase() && r.pattern.test(pathname));
      if (route === undefined) return json({ code: "not_found" }, 404);
      if (route.operation === "profile.me.get") {
        const n = scenarij === "dugi-tekst" ? LONGER : SHORT;
        return role === null ? json({ code: "unauthenticated" }, 401)
          : json({
            // The contract's shape (profile.me.get): the teacher's work views read roles and sessionTag
            // through the generated client, which refuses a body without them.
            institution: { slug: "izm", displayName: n.institution },
            roles: [role],
            displayName: role === "student" ? n.student : role === "network_engineer" ? "Operater A" : "Nastavnik A",
            journalScope: "4e84fd38a2f8f663661b8e1b2fc52bad9b9da56f8accead18bfd24ca20b96d12",
            sessionTag: "c87c2b8c6e066e9f0b3ddbb338a2188630c0364f769518a616173518dc6c603f",
          });
      }
      if (role === null) return json({ code: "unauthenticated" }, 401);
      if (route.operation === "profile.interface-locale.get") return json({ locale: null });
      if (route.operation === "platform.status.get") return json(STATUS);
      if (scenarij === "ucitavanje") return "hang";
      if (scenarij === "greska") return json({ code: "unavailable" }, 503);
      if (route.operation in own) return json(own[route.operation]);
      if (route.vector?.response !== undefined) {
        const { status, contentType } = route.vector.response;
        const patch = DOPUNA[route.operation];
        const patched = patch !== undefined && typeof route.vector.response.body === "object" ? patch(route.vector.response.body as Record<string, unknown>) : route.vector.response.body;
        // A vector names its own invented ids; the screens check the answer is about the id they asked
        // for, so every field named as a path parameter carries the id of this request.
        const ids = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(route.capture.exec(pathname)?.[i + 1] ?? "")]));
        const body = route.names.length === 0 ? patched : sameIds(patched, ids);
        return { status, contentType: contentType ?? (body === undefined ? undefined : "application/json"),
          body: body === undefined ? undefined : typeof body === "string" && contentType !== "application/json" ? body : JSON.stringify(body) };
      }
      return route.has204 ? { status: 204 } : json({ code: "not_found" }, 404);
    },
  };
}
