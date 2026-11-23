// PIL-K-KOMENTARI-EDITOR: the real port over src/client/comments.ts, against an in-memory
// collaboration.comments.post (/api/v1/comments/<action>). Invented texts and ids only.
import { describe, expect, it } from "vitest";

import { commentsPort } from "./port";
import { fakeRoute } from "./fake-route.test";

const T1 = "aaaaaaaa-0000-4000-8000-000000000001";
const T2 = "aaaaaaaa-0000-4000-8000-000000000002";

describe("commentsPort over src/client/comments", () => {
  it("reads the threads as comments with their replies", async () => {
    const route = fakeRoute();
    const read = await commentsPort({ options: route.options, locate: () => ({ from: 3, to: 9 }) }).read("doc-demo-1");
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.comments.map((c) => [c.id, c.role, c.text, c.resolved, c.replies.map((r) => r.text)])).toEqual([
      [T1, "teacher", "Tvrdnja traži izvor.", false, ["Dodat ću izvor."]],
      [T2, "teacher", "Jasan uvod.", true, []],
    ]);
    expect(read.comments[0]!.place).toEqual({ from: 3, to: 9, quote: "kućno kompostiranje", lost: false });
    expect(read.comments[1]!.place.lost).toBe(true);
    expect(route.calls).toEqual([{ action: "list", body: { documentId: "doc-demo-1" } }]);
  });

  it("a reply counts only as the server lists it again", async () => {
    const route = fakeRoute();
    const answer = await commentsPort({ options: route.options }).reply("doc-demo-1", T1, "Izvor je dodan.");
    expect(answer.kind).toBe("ok");
    if (answer.kind === "ok") expect(answer.comment.replies.map((r) => r.text)).toEqual(["Dodat ću izvor.", "Izvor je dodan."]);
    expect(route.calls.map((c) => c.action)).toEqual(["reply", "list"]);
  });

  it("maps refusals, lost answers and an ended session", async () => {
    expect((await commentsPort({ options: fakeRoute({ status: 403 }).options }).reply("d", T1, "Da.")).kind).toBe("rejected");
    expect((await commentsPort({ options: fakeRoute({ status: 401 }).options }).reply("d", T1, "Da.")).kind).toBe("signedOut");
    expect((await commentsPort({ options: fakeRoute({ status: 503 }).options }).reply("d", T1, "Da.")).kind).toBe("unknown");
    const route = fakeRoute();
    const ended = commentsPort({ options: route.options, current: () => false });
    expect((await ended.reply("d", T1, "Da.")).kind).toBe("signedOut");
    expect((await ended.read("d")).kind).toBe("signedOut");
    expect(route.calls).toEqual([]);
  });

  it("operations without a student route send nothing", async () => {
    const route = fakeRoute();
    const port = commentsPort({ options: route.options });
    const place = { from: 1, to: 2, quote: "x", lost: false };
    expect((await port.sendBack("d", T1, "")).kind).toBe("rejected");
    expect((await port.addPlace("d", T1, place)).kind).toBe("rejected");
    expect((await port.confirm("d", T1)).kind).toBe("rejected");
    expect((await port.saveTemplate({ text: "x", kind: "must" })).kind).toBe("rejected");
    expect((await port.deleteTemplate("t")).kind).toBe("rejected");
    // A new comment without an anchor for the place never leaves.
    expect((await port.create("d", { text: "Pitanje.", kind: null, place, saveAsTemplate: false })).kind).toBe("rejected");
    expect(route.calls).toEqual([]);
  });
});
