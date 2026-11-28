import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { literatureOf } from "./literature-model";
import { DOC } from "./literature-fixture";
import { LiteratureView, TeacherBibliographyHost, type LiteratureViewProps } from "./TeacherBibliographyHost";

const noop = () => {};
const GUIDANCE = { canWrite: true, seenAt: null,
  sources: [{ id: "s1", label: "Izmišljeni priručnik", requirement: "recommended" as const, proofCount: 2, createdAt: "2026-11-01T10:00:00.000Z" }],
  requests: [{ id: "r1", sourceId: "s1", instruction: "Potvrdite stranicu.", dueAt: "2026-11-30T23:59:59.000Z", closedAt: null }] };
const READY = { kind: "ready", revision: 9, savedMinute: "2026-11-22T10:00:00.000Z", literature: literatureOf(DOC) } as const;
const draw = (over: Partial<LiteratureViewProps>) => renderToStaticMarkup(createElement(LiteratureView, {
  state: READY, role: "teacher", submitted: false, seen: null, overview: false, message: "",
  onRetry: noop, onOverview: noop, onMarkSeen: noop, ...over,
}));

describe("TeacherBibliographyHost", () => {
  it("is closed until opened and then loads", () => {
    expect(renderToStaticMarkup(createElement(TeacherBibliographyHost, { documentId: "w1" }))).toContain("<summary");
    expect(renderToStaticMarkup(createElement(TeacherBibliographyHost, { documentId: "w1", defaultOpen: true })))
      .toContain("Učitavam literaturu rada…");
  });
});

describe("LiteratureView", () => {
  it("shows the failure states", () => {
    expect(draw({ state: null })).toContain("Učitavam literaturu rada…");
    expect(draw({ state: { kind: "signedOut" } })).toContain("Sesija je istekla. Prijavite se ponovno.");
    const unavailable = draw({ state: { kind: "unavailable" } });
    expect(unavailable).toContain("Literatura rada se zasad ne može učitati.");
    expect(unavailable).toContain("Pokušaj ponovno");
    const none = draw({ state: { kind: "noVersion" } });
    expect(none).toContain("Student još nema verziju rada na poslužitelju.");
    expect(none).toMatch(/<button[^>]*disabled[^>]*>Pregled literature<\/button>/);
  });
  it("keeps the write buttons off until the guidance says the teacher may write", () => {
    const html = draw({});
    expect(html).toContain("Prema zadnjoj verziji rada na poslužitelju (22. 11. 2026.).");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\+ Preporuči izvor<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\+ Obvezni izvor<\/button>/);
    expect(html).toContain("1 navod čeka potvrdu.");
    expect(html).toContain("Izmišljena (2015), str. 14");
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Pregled literature/);
  });
  it("turns the buttons on and lists guidance, requests and sources", () => {
    const html = draw({ guidance: GUIDANCE });
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>\+ Preporuči izvor<\/button>/);
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>\+ Obvezni izvor<\/button>/);
    expect(html).toContain("Izmišljeni priručnik: rok 30. 11. 2026. – Potvrdite stranicu.");
    expect(html).toContain("Povuci zahtjev");
    expect(html).toContain("Zatraži potvrdu");
    expect(html).toContain("Potvrde (2)");
    expect(html).toContain("Preporučeni izvori");
    expect(html).toContain("Ukloni");
  });
  it("shows the proofs of a source", () => {
    const html = draw({ guidance: GUIDANCE, dialogue: { kind: "proofs", sourceId: "s1" }, proofs: { kind: "ready", proofs: [{ id: "p1", page: "14", note: "Bilješka" }] } });
    expect(html).toContain("str. 14");
    expect(html).toContain("Bilješka");
    expect(draw({ guidance: GUIDANCE, dialogue: { kind: "proofs", sourceId: "s1" }, proofs: { kind: "ready", proofs: [] } })).toContain("Student još nije priložio potvrdu");
  });
  it("offers the request form and the write problem", () => {
    const html = draw({ guidance: GUIDANCE, dialogue: { kind: "request", sourceId: "s1" }, problem: "Radnja nije spremljena. Pokušajte ponovno." });
    expect(html).toContain("Što student treba potvrditi");
    expect(html).toContain("Pošalji zahtjev");
    expect(html).toContain("Radnja nije spremljena. Pokušajte ponovno.");
  });
  it("draws the overview with new sources and the review mark", () => {
    const html = draw({ overview: true, seen: { when: "20. 11. 2026.", ids: [DOC.sources[0]!.id] }, message: "Zapisano. Izvori dodani nakon ovoga bit će označeni kao novi." });
    expect(html).toContain("3 izvora · citirano 2 · novo od pregleda 20. 11. 2026.: 2");
    for (const header of ["Izvor", "Vrsta", "Navoda"]) expect(html).toContain(`>${header}`);
    expect(html.match(/>novo</g)).toHaveLength(2);
    expect(html).toContain("Označi literaturu pregledanom");
    expect(html).toContain("Zapisano. Izvori dodani nakon ovoga bit će označeni kao novi.");
    expect(html).toContain("Vrijeme pregleda sprema se na poslužitelju; popis pregledanih izvora samo na ovom uređaju.");
  });
  it("lets a collaborator only read", () => {
    const html = draw({ role: "collaborator", overview: true });
    expect(html).toContain("Suradnik literaturu samo čita.");
    expect(html).not.toContain("Preporuči izvor");
    expect(html).not.toContain("Obvezni izvor<");
    expect(draw({ role: "collaborator", guidance: GUIDANCE })).not.toContain("Zatraži potvrdu");
    expect(html).not.toContain("Označi literaturu pregledanom");
  });
  it("sends nothing new once the work is submitted", () => {
    const html = draw({ submitted: true });
    expect(html).toContain("Rad je predan: preporuke i zahtjevi više se ne šalju.");
    expect(html).not.toContain("+ Preporuči izvor");
    expect(draw({ submitted: true, guidance: GUIDANCE })).not.toContain("Zatraži potvrdu");
  });
});
