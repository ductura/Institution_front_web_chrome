// In-memory stand-in for the comments route (WEB-2130). Invented people and texts only.
import type { Comment, CommentsPort, Place, Template, Write } from "./model";

const place = (from: number, to: number, quote: string): Place => ({ from, to, quote, lost: false });
export const FAKE_COMMENTS: readonly Comment[] = [
  { id: "c1", role: "teacher", kind: "must", text: "Tvrdnja traži izvor. Odakle je ovaj podatak?", place: place(10, 40, "Većina studenata radi noću."), also: [], resolved: false, confirmed: null, round: 1, ts: 1000, replies: [], template: "t1" },
  { id: "c2", role: "teacher", kind: "q", text: "Što iz toga slijedi za Vaše pitanje?", place: place(60, 90, "Izvor kaže drugačije."), also: [], resolved: false, confirmed: null, round: 1, ts: 2000, replies: [{ id: "r1", role: "student", text: "Dodat ću objašnjenje.", ts: 3000 }], template: null },
  { id: "c3", role: "teacher", kind: "praise", text: "Jasan uvod.", place: place(0, 9, "Uvod rada"), also: [], resolved: false, confirmed: null, round: 1, ts: 1500, replies: [], template: null },
];
export const FAKE_TEMPLATES: readonly Template[] = [{ id: "t1", text: "Tvrdnja traži izvor. Odakle je ovaj podatak?", kind: "must" }];

export function fakeCommentsPort(seed: readonly Comment[] = FAKE_COMMENTS, who: "teacher" | "student" = "student"): CommentsPort & { readonly all: () => readonly Comment[] } {
  let list = [...seed];
  let templates = [...FAKE_TEMPLATES];
  let n = 100;
  const patch = (id: string, f: (c: Comment) => Comment): Write => {
    const c = list.find((x) => x.id === id);
    if (!c) return { kind: "rejected" };
    const next = f(c);
    list = list.map((x) => (x.id === id ? next : x));
    return { kind: "ok", comment: next };
  };
  return {
    all: () => list,
    async read() { return { kind: "ready", comments: list, round: 1, templates }; },
    async create(_w, input) {
      const c: Comment = { id: `n${n++}`, role: who, kind: input.kind, text: input.text, place: input.place, also: [], resolved: false, confirmed: null, round: 1, ts: n * 1000, replies: [], template: null };
      list = [...list, c];
      if (input.saveAsTemplate && input.kind) templates = [...templates, { id: `tp${n++}`, text: input.text, kind: input.kind }];
      return { kind: "ok", comment: c };
    },
    async reply(_w, id, body) { return patch(id, (c) => ({ ...c, replies: [...c.replies, { id: `r${n++}`, role: who, text: body, ts: n * 1000 }] })); },
    async setResolved(_w, id, resolved) { return patch(id, (c) => ({ ...c, resolved, confirmed: resolved && who === "teacher" ? true : null })); },
    async confirm(_w, id) { return patch(id, (c) => ({ ...c, confirmed: true })); },
    async sendBack(_w, id, note) { return patch(id, (c) => ({ ...c, resolved: false, confirmed: null, replies: note ? [...c.replies, { id: `r${n++}`, role: "teacher", text: note, ts: n * 1000 }] : c.replies })); },
    async addPlace(_w, id, p) { return patch(id, (c) => ({ ...c, also: [...c.also, p] })); },
    async saveTemplate(entry) { templates = [...templates, { id: `tp${n++}`, ...entry }]; return { kind: "ok", templates }; },
    async deleteTemplate(id) { templates = templates.filter((t) => t.id !== id); return { kind: "ok", templates }; },
  };
}
