import { describe, expect, it } from "vitest";

import { allObservations, guessRole, hypothesesOf, observationsOf, roleOf, threadTable, wholeNotes, thesisTerms } from "./advice";
import { balanceRows, distribute, statusText, workStatus } from "./balance";
import { chaptersOf, norm, type AssistBlock } from "./blocks";
import { daysUntil, deadlineRows } from "./deadlines";
import { chipsOf, filterHeadings, nextPlace } from "./jump";
import { holesOf, nextSteps, type NextStepInput } from "./next-step";
import { assistHr as t } from "./messages.hr";
import { makeSkeleton, parseChapters, wizardAllowed } from "./wizard";
import { EMPTY_NOTES, LIMITS, loadNotes, notesKey, openTodos, parseNotes, planItemInText, pruneNotes, saveNotes, withPlan, withRole, withTodoAdded, withTodoDone, withTodoRemoved } from "./work-notes";

// WEB-2128: invented text only (no real person, no real work).
const h = (id: string, level: number, text: string): AssistBlock => ({ id, kind: "heading", level, text, cites: 0 });
const p = (id: string, text: string, cites = 0): AssistBlock => ({ id, kind: "text", level: 0, text, cites });
const words = (n: number, w = "riječ") => Array.from({ length: n }, () => w).join(" ");

const blocks: AssistBlock[] = [
  h("a", 1, "Uvod"), p("a1", `Pitanje rada glasi: kako čitanje naglas utječe na rječnik. ${words(160)}`),
  h("b", 1, "Teorijski okvir"), p("b1", `${words(320, "pojam")} H1 vrijedi`, 0),
  h("c", 1, "Metodologija"), p("c1", `${words(160)} metoda i izvori`),
  h("d", 1, "Analiza"), h("d1", 2, "Prvi dio"), p("d11", words(400)), h("d2", 2, "Drugi dio"), p("d21", words(60)), h("d3", 2, "Treći dio"), p("d31", words(400)),
  h("e", 1, "Zaključak"), p("e1", words(170)),
];
const chapters = chaptersOf(blocks);
const thesis = "Kako čitanje naglas utječe na rječnik učenika?";
const input = { chapters, thesis, roles: {} };

describe("chapters of the work", () => {
  it("numbers chapters and subchapters by position", () => {
    expect(chapters.map((c) => c.number)).toEqual(["1", "2", "3", "4", "4.1", "4.2", "4.3", "5"]);
    expect(chapters.find((c) => c.id === "d1")!.parentId).toBe("d");
  });
  it("normalises diacritics", () => expect(norm("Zaključak đak")).toBe("zakljucak dak"));
  it("an empty heading is an empty chapter", () => expect(chaptersOf([h("x", 1, "Prazno")])[0]!.empty).toBe(true));
});

describe("roles of chapters", () => {
  it.each([
    ["Uvod", "uvod"], ["Zaključna razmatranja i zaključak", "zakljucak"], ["Rasprava", "rasprava"], ["Diskusija", "rasprava"],
    ["Dizajn istraživanja", "metodologija"], ["Metodologija", "metodologija"], ["Teorijski okvir", "teorija"], ["Pregled literature", "teorija"], ["Analiza slučaja", "empirija"],
  ] as const)("%s is %s", (title, role) => expect(guessRole(title)).toBe(role));
  it("a chosen role beats the guess; a subchapter takes the role of its parent", () => {
    expect(roleOf(chapters, "d", { d: "rasprava" })).toBe("rasprava");
    expect(roleOf(chapters, "d1", { d: "rasprava" })).toBe("rasprava");
    expect(roleOf(chapters, "missing", {})).toBe("drugo");
  });
  it("has a recommendation for every one of the seven roles", () => {
    expect(Object.keys(t.rec)).toHaveLength(7);
    expect(Object.keys(t.roles)).toEqual(Object.keys(t.rec));
  });
});

describe("observations", () => {
  it("terms of the question of the work: long, not stop words, present in the work", () => {
    const terms = thesisTerms(thesis, "čitanje rječnik učenika");
    expect(terms.map((x) => x.word)).toEqual(["čitanje", "rječnik", "učenika"].filter((w) => ["čitanje", "rječnik", "učenika"].includes(w)));
    expect(thesisTerms("Kako je to tijekom godine", "tijekom godine")).toEqual([]);
  });
  it("few citations in a theory chapter of 300 words", () => {
    expect(observationsOf(input, "b").items).toContain(t.obs.fewCites(0, 322));
  });
  it("a chapter under 150 words is not ready and has no content observations", () => {
    const short = chaptersOf([h("q", 1, "Uvod"), p("q1", words(10))]);
    expect(observationsOf({ chapters: short, thesis: "", roles: {} }, "q")).toEqual({ ready: false, items: [] });
  });
  it("methodology names what is missing", () => {
    const own = observationsOf(input, "c").items.find((i) => i.startsWith("Ne spominje:"));
    expect(own).toBe("Ne spominje: postupak analize, ograničenja.");
  });
  it("conclusion without hypotheses confirmation and limits", () => {
    const items = observationsOf(input, "e").items;
    expect(items).toContain(t.obs.notConfirmed);
    expect(items).toContain(t.obs.noLimits);
    expect(items).toContain(t.obs.missingHypotheses("H1"));
  });
  it("introduction that does not announce the hypotheses or the structure", () => {
    const items = observationsOf(input, "a").items;
    expect(items).toContain(t.obs.noStructure);
    expect(items).toContain(t.obs.noHypothesesAnnounced);
    expect(items).not.toContain(t.obs.noQuestion);
  });
  it("a subchapter much shorter than the others is flagged with the mean", () => {
    const items = observationsOf(input, "d2").items;
    expect(items).toEqual([t.obs.shorter(60, 287)]);
  });
  it("lists every observation with its chapter", () => {
    expect(allObservations(input).every((o) => chapters.some((c) => c.id === o.chapterId))).toBe(true);
  });
});

describe("the thread of the work", () => {
  it("finds hypothesis labels in order", () => expect(hypothesesOf("H2 pa H1 pa H2")).toEqual(["H1", "H2"]));
  it("a hypothesis mentioned in one chapter only is noted; no question is noted", () => {
    const notes = wholeNotes({ chapters, thesis: "", roles: {} });
    expect(notes.map((n) => n.text)).toContain(t.whole.noThesis);
    expect(notes.map((n) => n.text)).toContain(t.whole.onlyOnce("H1", "2", "Teorijski okvir"));
  });
  it("the table marks where each hypothesis appears", () => {
    const table = threadTable(chapters);
    expect(table.columns.map((c) => c.number)).toEqual(["1", "2", "3", "4", "5"]);
    expect(table.rows).toEqual([{ label: "H1", cells: [false, true, false, false, false] }]);
    expect(threadTable(chaptersOf([h("x", 1, "Uvod")])).rows).toEqual([]);
  });
  it("the conclusion that does not return to the question is noted", () => {
    const weak = chaptersOf([h("a", 1, "Uvod"), p("a1", "rječnik čitanje učenika"), h("z", 1, "Zaključak"), p("z1", words(20))]);
    expect(wholeNotes({ chapters: weak, thesis, roles: {} }).map((n) => n.text)).toContain(t.whole.weakReturn);
  });
});

describe("balance and distribution of the range", () => {
  it("distributes by roles, in steps of 50, never under 100", () => {
    const targets = distribute(chapters, {}, { min: 4000, max: 6000 })!;
    expect(targets.a).toBe(450);
    expect(targets.e).toBe(350);
    expect(targets.b).toBe(1000);
    expect(targets.c).toBe(500);
    expect(Object.values(targets).every((v) => v >= 100 && v % 50 === 0)).toBe(true);
  });
  it("without a range there is nothing to distribute", () => expect(distribute(chapters, {}, { min: null, max: 5000 })).toBeNull());
  it("work status over, under and in range", () => {
    expect(statusText(workStatus(5200, { min: 4000, max: 5000 }))).toBe(t.balance.over(200));
    expect(statusText(workStatus(3000, { min: 4000, max: 5000 }))).toBe(t.balance.under(1000));
    expect(statusText(workStatus(4500, { min: 4000, max: 5000 }))).toBe(t.balance.ok);
    expect(statusText(workStatus(10, { min: null, max: null }))).toBe(t.balance.noRange);
  });
  it("a row over 110 % of its goal is marked over", () => {
    const rows = balanceRows(chapters, { b: 200, a: 5000 });
    expect(rows.find((r) => r.id === "b")!.over).toBe(true);
    expect(rows.find((r) => r.id === "a")!.text).toContain("nedostaje");
    expect(rows.find((r) => r.id === "c")!.goal).toBeNull();
  });
});

describe("next step", () => {
  const base: NextStepInput = { ...input, submitted: false, teacherView: false, range: { min: null, max: null } };
  it("submitted work points to the receipt; the mentor view has no steps", () => {
    expect(nextSteps({ ...base, submitted: true })[0]!.text).toBe(t.next.submitted);
    expect(nextSteps({ ...base, teacherView: true })).toEqual([]);
  });
  it("revision asked by the mentor comes first", () => {
    const steps = nextSteps({ ...base, review: { status: "revise", due: "24. 11. 2026.", openComments: 3, firstCommentChapterId: "b" } });
    expect(steps[0]!.text).toBe("Mentor čeka doradu do 24. 11. 2026.: 3 otvorenih komentara, prvi u 2 Teorijski okvir.");
    expect(nextSteps({ ...base, review: { status: "revise", due: null, openComments: 0, firstCommentChapterId: null } })[0]!.text).toBe("Mentor čeka doradu. Komentari su riješeni; pošaljite doradu na pregled.");
  });
  it("holes block the submission and name the first chapter", () => {
    const withHole = chaptersOf([h("a", 1, "Uvod"), p("a1", "tekst [?] i [izvor]")]);
    expect(holesOf(withHole).count).toBe(2);
    expect(nextSteps({ ...base, chapters: withHole })[0]!.text).toBe(t.next.holes(2, "1 Uvod"));
  });
  it("over and under the range, an empty chapter, unlinked citations, requirements and tasks", () => {
    const total = chapters.filter((c) => c.parentId === null).length;
    expect(total).toBe(5);
    expect(nextSteps({ ...base, range: { min: null, max: 100 } })[0]!.text).toContain("iznad granice");
    expect(nextSteps({ ...base, range: { min: 99999, max: null } })[0]!.text).toContain("Do donje granice nedostaje");
    const empty = chaptersOf([h("a", 1, "Uvod"), h("b", 1, "Zaključak"), p("b1", "tekst")]);
    expect(nextSteps({ ...base, chapters: empty })[0]!.text).toBe(t.next.emptyChapter("1 Uvod"));
    const texts = nextSteps({ ...base, unlinkedCites: 2, requirements: [{ text: "Sažetak", detail: "Nedostaje." }], todos: [{ chapterId: "b", text: "dodati izvor" }, { chapterId: "b", text: "drugo" }] }).map((s) => s.text);
    expect(texts).toContain(t.next.unlinked(2));
    expect(texts).toContain("Zahtjevi fakulteta: Sažetak. Nedostaje.");
    expect(texts.filter((x) => x.startsWith("Vaš zadatak"))).toEqual([t.next.todo("2 Teorijski okvir", "dodati izvor")]);
  });
  it("nothing urgent, and a work without chapters offers the wizard", () => {
    const calm = chaptersOf([h("a", 1, "Uvod"), p("a1", `pitanje struktura poglavlja ${words(10)}`)]);
    expect(nextSteps({ ...base, chapters: calm, thesis: "" })[0]!.text).toBe(t.next.nothing);
    expect(nextSteps({ ...base, chapters: [] })[0]).toEqual({ text: t.next.empty, target: { kind: "wizard" } });
  });
});

describe("quick jump", () => {
  it("filters headings without diacritics and keeps the parent of a match", () => {
    expect(filterHeadings(chapters, "zakljuc").map((c) => c.id)).toEqual(["e"]);
    expect(filterHeadings(chapters, "treci").map((c) => c.id)).toEqual(["d", "d3"]);
    expect(filterHeadings(chapters, "")).toHaveLength(chapters.length);
  });
  it("chips carry a count and an unknown kind is left out; the next place wraps round", () => {
    const chips = chipsOf({ hole: [{ chapterId: "a" }, { chapterId: "b" }], comment: [] });
    expect(chips.map((c) => c.label)).toEqual(["Za provjeru 2 ›"]);
    expect(nextPlace(chips[0]!.places, -1)).toEqual({ place: { chapterId: "a" }, cursor: 0 });
    expect(nextPlace(chips[0]!.places, 1)).toEqual({ place: { chapterId: "a" }, cursor: 0 });
    expect(nextPlace([], 0)).toBeNull();
  });
});

describe("deadlines", () => {
  const today = new Date(2026, 10, 22);
  it("counts days and sorts by date", () => {
    expect(daysUntil("2026-11-24", today)).toBe(2);
    expect(daysUntil("nije datum", today)).toBeNull();
    const rows = deadlineRows([
      { key: "s", label: "Rok predaje rada", date: "2026-11-30", note: "Seminar" },
      { key: "o", label: "Vaš rok za Uvod", date: "2026-11-20", note: "postavili ste sami" },
      { key: "r", label: "Rok dorade", date: "2026-11-22", note: "traži mentor" },
    ], today);
    expect(rows.map((r) => r.key)).toEqual(["o", "r", "s"]);
    expect(rows.map((r) => r.when)).toEqual(["20. 11. 2026. · prošao", "22. 11. 2026. · danas", "30. 11. 2026. · za 8 dana"]);
  });
});

describe("notes beside the work", () => {
  it("a broken store is an empty one, field by field", () => {
    expect(parseNotes("{")).toBe(EMPTY_NOTES);
    expect(parseNotes(JSON.stringify({ thesis: 5, roles: { a: "nije", b: "uvod" }, targets: { a: -1, b: 300 }, plans: { a: [1, "x"] }, todos: { a: [{ id: "1", text: "t", done: true }, { id: 2 }] } })))
      .toEqual({ ...EMPTY_NOTES, roles: { b: "uvod" }, targets: { b: 300 }, plans: { a: ["x"] }, todos: { a: [{ id: "1", text: "t", done: true }] } });
  });
  it("saves and loads through the storage; no storage means nothing is kept", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    const notes = withRole(EMPTY_NOTES, "a", "uvod");
    expect(saveNotes(storage, "w1", notes)).toBe(true);
    expect(map.has(notesKey("w1"))).toBe(true);
    expect(loadNotes(storage, "w1")).toEqual(notes);
    expect(saveNotes(null, "w1", notes)).toBe(false);
    expect(loadNotes(null, "w1")).toBe(EMPTY_NOTES);
  });
  it("plan, tasks and pruning", () => {
    let n = withPlan(EMPTY_NOTES, "a", "prvo\n\n drugo \n" + "x\n".repeat(30));
    expect(n.plans.a!.length).toBe(LIMITS.plan);
    expect(withPlan(n, "a", "  ").plans.a).toBeUndefined();
    n = withTodoAdded(n, "a", "napisati uvod", "t1");
    n = withTodoAdded(n, "a", "   ", "t2");
    expect(n.todos.a).toHaveLength(1);
    expect(openTodos(withTodoDone(n, "a", "t1", true), "a")).toEqual([]);
    expect(withTodoRemoved(n, "a", "t1").todos.a).toEqual([]);
    expect(pruneNotes({ ...n, lastChapterId: "gone" }, ["b"])).toEqual({ ...EMPTY_NOTES });
  });
  it("a plan item is in the text when half of its stems occur", () => {
    expect(planItemInText("fonološka svjesnost kod djece", "o svjesnosti i fonologiji djece", norm)).toBe(true);
    expect(planItemInText("povijest štrajkova", "ništa o tome", norm)).toBe(false);
    expect(planItemInText("da je", "da je", norm)).toBe(false);
  });
});

describe("start of a work in three steps", () => {
  it("the four kinds have the chapters of the prototype", () => {
    expect(Object.keys(t.wizard.kinds)).toEqual(["emp", "slucaj", "pregled", "esej"]);
    expect(t.wizard.kinds.esej.chapters).toEqual(["Uvod", "Razrada", "Zaključak"]);
    expect(t.wizard.kinds.emp.chapters).toHaveLength(6);
  });
  it("the skeleton takes one chapter per line and never exceeds the limits", () => {
    expect(parseChapters("Uvod\n\n  Razrada \nZaključak")).toEqual(["Uvod", "Razrada", "Zaključak"]);
    expect(parseChapters("x\n".repeat(30))).toHaveLength(12);
    expect(makeSkeleton("Naslov", " Pitanje? ", "Uvod\nZaključak")).toEqual({ title: "Naslov", question: "Pitanje?", chapters: ["Uvod", "Zaključak"] });
    expect(makeSkeleton("N", "q", " \n ")).toBeNull();
  });
  it("a work that already has chapters is never overwritten", () => {
    expect(wizardAllowed(0)).toBe(true);
    expect(wizardAllowed(2)).toBe(false);
  });
});
