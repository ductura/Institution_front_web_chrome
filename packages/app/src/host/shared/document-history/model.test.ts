import { describe, expect, it } from "vitest";

import { FAKE_IMPORTS, fakeDocumentHistoryPort } from "./fake-port";
import { claimLines, historyView, loadHistory } from "./model";
import { documentHistoryMessages as text } from "./messages.hr";

describe("document history (WEB-1802)", () => {
  it("lists imports newest first and answers the same for any reader (the port takes no role)", async () => {
    const port = fakeDocumentHistoryPort();
    const a = await loadHistory(port, "w1");
    const b = await loadHistory(port, "w1");
    expect(a).toEqual(b);
    if (a.kind !== "ready") throw new Error("expected ready");
    expect(a.rows.map((r) => r.id)).toEqual(["imp-2", "imp-1"]);
  });

  it("shows file metadata as a claim from the file, never as a fact", async () => {
    const view = await loadHistory(fakeDocumentHistoryPort(), "w1");
    if (view.kind !== "ready") throw new Error("expected ready");
    const row = view.rows.find((r) => r.id === "imp-1")!;
    expect(row.claims.map((c) => c.key)).toEqual(["fileName", "creator", "createdAt", "modifiedAt", "revisions"]);
    for (const c of row.claims) expect(c.text.endsWith(`(${text.claimBadge})`)).toBe(true);
    expect(text.claimBadge).toBe("tvrdnja iz datoteke");
  });

  it("skips absent or invalid claims and keeps the import itself", () => {
    expect(claimLines({ creator: "", revisions: -1 })).toEqual([]);
    const view = historyView({ kind: "ready", imports: [{ ...FAKE_IMPORTS[1]!, claims: {} }] });
    expect(view).toMatchObject({ kind: "ready", rows: [{ id: "imp-2", claims: [] }] });
  });

  it("has an empty state and never invents data on failure", async () => {
    expect(historyView({ kind: "ready", imports: [] })).toEqual({ kind: "empty" });
    expect(historyView({ kind: "signedOut" })).toEqual({ kind: "signedOut" });
    const failing = { read: async () => { throw new Error("x"); } };
    expect(await loadHistory(failing, "w1")).toEqual({ kind: "unavailable" });
  });
});
