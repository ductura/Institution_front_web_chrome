import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { ASSIGNMENT, fakeWithdrawServer } from "./fake-port";
import { withdrawText } from "./messages.hr";
import { canWithdraw, readWithdrawalState, receiptFile, receiptLine, withdraw, withdrawNote } from "./model";

describe("withdrawal state (WEB-1903)", () => {
  it("offers the button only on the server's word", async () => {
    const server = fakeWithdrawServer();
    const read = await readWithdrawalState(server.call, ASSIGNMENT);
    expect(read.kind === "ready" && canWithdraw(read.state)).toBe(true);
    server.close();
    const after = await readWithdrawalState(server.call, ASSIGNMENT);
    expect(after.kind === "ready" && canWithdraw(after.state)).toBe(false);
    // A client clock far past any deadline changes nothing: the field alone decides.
    expect(canWithdraw({ withdrawable: true, receipts: [] })).toBe(true);
  });

  it("reads a broken answer as unknown, never as 'nothing to withdraw'", async () => {
    const bad = async () => ({ ok: true as const, status: 200, body: { withdrawable: "yes", receipts: [] } });
    expect(await readWithdrawalState(bad, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    const rejected = async () => ({ ok: false as const, status: 0, code: "client_rejected" });
    expect(await readWithdrawalState(rejected, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readWithdrawalState(async () => ({ ok: false as const, status: 401, code: "x" }), ASSIGNMENT)).toEqual({ kind: "session-expired" });
    expect(await readWithdrawalState(fakeWithdrawServer().call, "not-an-id")).toEqual({ kind: "nepoznato" });
  });
});

describe("withdrawing", () => {
  it("says withdrawn only with the server's signed receipt", async () => {
    const server = fakeWithdrawServer();
    const followup = await withdraw(server.call, ASSIGNMENT);
    expect(followup).toEqual({ note: { tone: "status", text: withdrawText.withdrawn }, refresh: true });
    expect(server.receipts).toHaveLength(1);
    const unsigned = async () => ({ ok: true as const, status: 200, body: { receipt: { ...server.receipts[0], signature: "" } } });
    expect((await withdraw(unsigned, ASSIGNMENT))?.note.text).toBe(withdrawText.unknown);
  });

  it("closed after the deadline: 409 reads as closed and the state is read again", async () => {
    const server = fakeWithdrawServer({ open: false });
    expect(await withdraw(server.call, ASSIGNMENT)).toEqual({ note: { tone: "alert", text: withdrawText.closed }, refresh: true });
    expect(server.receipts).toHaveLength(0);
  });

  it("names the other failures and hands a lost session back", async () => {
    expect(withdrawNote({ kind: "nepoznato" })?.refresh).toBe(false);
    expect(withdrawNote({ kind: "greska", code: "not_found" })).toEqual({ note: { tone: "alert", text: withdrawText.notFound }, refresh: true });
    expect(withdrawNote({ kind: "session-expired" })).toBeNull();
    const down = async () => { throw new Error("offline"); };
    expect((await withdraw(down, ASSIGNMENT))?.note.text).toBe(withdrawText.unknown);
  });
});

describe("downloadable receipt", () => {
  it("is the signed fields as JSON with a stable file name", async () => {
    const server = fakeWithdrawServer();
    await withdraw(server.call, ASSIGNMENT);
    const [receipt] = server.receipts as [(typeof server.receipts)[number]];
    const file = receiptFile(receipt);
    expect(file.filename).toBe("potvrda-povlacenja-00000000-r7-00000000.json");
    expect(JSON.parse(file.content)).toEqual(receipt);
    expect(receiptLine(receipt)).toContain("Revizija 7");
  });

  it("holds no forbidden term in its copy", () => {
    for (const value of Object.values(withdrawText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
