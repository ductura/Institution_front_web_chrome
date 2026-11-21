import { describe, expect, it } from "vitest";

import { fakeCommentBankPort, fakeDraftCommentsPort, FAKE_BANK } from "./fake-port";
import {
  publishDraftGroup, saveDraftComment, searchBank, visibleToStudent, type DraftCommentsPort,
} from "./model";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

describe("deferred comments (WEB-1704)", () => {
  it("never shows a draft to the student, and shows it once published", async () => {
    const port = fakeDraftCommentsPort();
    const saved = await saveDraftComment(port, ID, "Izmišljeni komentar jedan");
    await saveDraftComment(port, ID, "Izmišljeni komentar dva");
    expect(saved.kind).toBe("saved");
    expect(port.studentView()).toEqual([]);
    expect(visibleToStudent(port.all())).toEqual([]);

    const drafts = await port.listDrafts(ID);
    if (drafts.kind !== "ready") throw new Error("expected drafts");
    const result = await publishDraftGroup(port, ID, drafts.drafts.map((d) => d.id));
    expect(result.kind).toBe("published");
    expect(port.studentView().map((c) => c.body)).toEqual(["Izmišljeni komentar jedan", "Izmišljeni komentar dva"]);
  });

  it("sends no empty draft and no empty group", async () => {
    const port = fakeDraftCommentsPort();
    expect(await saveDraftComment(port, ID, "   ")).toEqual({ kind: "rejected" });
    expect(await publishDraftGroup(port, ID, [])).toEqual({ kind: "rejected" });
    expect(port.all()).toEqual([]);
  });

  it("treats an answer that does not match what was sent as unknown", async () => {
    const lying: DraftCommentsPort = {
      listDrafts: async () => ({ kind: "unavailable" }),
      saveDraft: async () => ({ kind: "saved", draft: { id: "x", body: "Drugi tekst", state: "draft", savedAt: "2026-11-21T10:00:00.000Z" } }),
      publishDrafts: async () => ({ kind: "published", ids: ["a"] }),
    };
    expect(await saveDraftComment(lying, ID, "Tekst")).toEqual({ kind: "unknown" });
    expect(await publishDraftGroup(lying, ID, ["a", "b"])).toEqual({ kind: "unknown" });
    const throwing: DraftCommentsPort = { ...lying, publishDrafts: async () => { throw new Error("mreža"); } };
    expect(await publishDraftGroup(throwing, ID, ["a"])).toEqual({ kind: "unknown" });
  });
});

describe("comment bank search (WEB-1704)", () => {
  it("filters by every word, ignoring case and accents", () => {
    expect(searchBank(FAKE_BANK, "")).toEqual(FAKE_BANK);
    expect(searchBank(FAKE_BANK, "ZAKLJUCAK").map((e) => e.id)).toEqual(["b3"]);
    expect(searchBank(FAKE_BANK, "odlomak uvodnu").map((e) => e.id)).toEqual(["b2"]);
    expect(searchBank(FAKE_BANK, "ništa takvo")).toEqual([]);
  });

  it("reads the bank through its port", async () => {
    expect((await fakeCommentBankPort().read()).kind).toBe("ready");
  });
});
