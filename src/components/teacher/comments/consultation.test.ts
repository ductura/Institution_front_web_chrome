import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TeacherComments, { type PlacedThread } from "../TeacherComments";
import { consultationEntries, consultationText } from "./consultation";

const first = "acb5f2bb-8cb1-4f10-8fd0-471cf555ecc5";
const second = "f56539c2-03f9-4efb-b3dd-ce209c68d06c";
const nodeOrder = [{ id: first }, { id: second }];

function placed(
  number: number, nodeId: string, start: number, state: PlacedThread["thread"]["state"] = "open",
): PlacedThread {
  const quote = "Kućno kompostiranje";
  const end = start + quote.length;
  return {
    range: { nodeId, start, end }, pending: false,
    thread: {
      id: `nit-${number}`, number, state,
      anchor: { nodeId, startHint: start, endHint: end, quote, prefix: "", suffix: "" },
      comments: [{
        id: `komentar-${number}`, body: `Dopunite primjer ${number}.`, isOwn: true, role: "teacher",
        createdWindow: "2026-11-20T10:00:00.000Z", deletedWindow: null,
      }],
    },
  };
}

describe("Ispis za konzultacije", () => {
  it("takes open and answered threads in passage order and skips resolved or unplaced threads", () => {
    const withoutPlace = { ...placed(6, first, 0), range: null };
    const entries = consultationEntries([
      placed(1, second, 0), placed(2, first, 29), placed(3, first, 0, "answered"),
      placed(4, first, 0, "resolved"), placed(5, "izvan-prikaza", 0), withoutPlace,
    ], nodeOrder);
    expect(entries.map(({ id }) => id)).toEqual(["nit-3", "nit-2", "nit-1"]);
  });

  it("preserves replies as text and skips deleted entries", () => {
    const item = placed(1, first, 0);
    const root = item.thread.comments[0]!;
    const deleted = { ...root, id: "uklonjen", body: null, deletedWindow: root.createdWindow };
    const reply = { ...root, id: "odgovor", body: "Primjer: <vrt>.", isOwn: false, role: "student" as const };
    const entries = consultationEntries([{
      ...item, thread: { ...item.thread, comments: [deleted, reply] },
    }], nodeOrder);
    expect(consultationText(entries)).toBe([
      "Ispis za konzultacije", "", "Komentar 1", "„Kućno kompostiranje”", "Student · Primjer: <vrt>.",
    ].join("\n"));
    expect(consultationEntries([{ ...item, thread: { ...item.thread, comments: [deleted] } }], nodeOrder)).toEqual([]);
  });

  it("offers print only after a successful read and leaves submitted work read-only", () => {
    const item = placed(1, first, 0);
    const props = {
      documentId: "demo-kompostiranje", placed: [item], nodeOrder, draft: item.thread.anchor,
      current: () => true, onReload: () => {}, onDraftDone: () => {}, onShow: () => {},
    };
    const available = renderToStaticMarkup(createElement(TeacherComments, {
      ...props, outcome: { kind: "ok", threads: [item.thread] }, readOnly: true,
    }));
    expect(available).toContain("Ispis za konzultacije");
    expect(available).toContain("Pokaži u tekstu");
    expect(available).not.toContain("<textarea");
    expect(available).not.toContain("Označi riješenim");
    const forbidden = renderToStaticMarkup(createElement(TeacherComments, {
      ...props, outcome: { kind: "forbidden" }, draft: null,
    }));
    expect(forbidden).not.toContain("Ispis za konzultacije");
    expect(forbidden).not.toContain("Dopunite primjer");
  });
});
