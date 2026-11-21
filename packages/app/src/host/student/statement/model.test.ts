import { describe, expect, it } from "vitest";

import { attachFile, helpAfterRead, helpValid, isReadOnly, printoutError, saveHelp, withKind } from "./model";
import { fakeStatementPort, PROBE_LIMITS } from "./fake-port";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

describe("statement: printout and human help (WEB-1503)", () => {
  it("refuses a disallowed format before the port is called", async () => {
    const port = fakeStatementPort();
    const read = await port.read(ID);
    const result = await attachFile(port, ID, read, file("razgovor.exe", "application/x-msdownload"));
    expect(result.kind).toBe("invalid");
    expect(port.attached).toEqual([]);
    expect(printoutError({ name: "a.pdf", type: "application/pdf", size: PROBE_LIMITS.maxBytes + 1 }, PROBE_LIMITS)).toContain("prevelika");
    expect(printoutError({ name: "a.pdf", type: "text/plain", size: 5 }, PROBE_LIMITS)).toContain("format");
  });

  it("sends an allowed printout and the help, and takes the statement text from the server", async () => {
    const port = fakeStatementPort();
    const read = await port.read(ID);
    expect(read.kind === "ready" && read.statementText).toBe("Izmišljeni tekst izjave sa servera.");
    expect((await attachFile(port, ID, read, file("razgovor.pdf", "application/pdf"))).kind).toBe("saved");
    expect((await saveHelp(port, ID, read, { kind: "proofreading", text: " Izmišljena lektura " })).kind).toBe("saved");
    expect(port.saved).toEqual([{ kind: "proofreading", text: "Izmišljena lektura" }]);
    expect(helpValid({ kind: "other", text: "" })).toBe(false);
    expect(helpValid({ kind: "none", text: "" })).toBe(true);
  });

  it("refuses a help kind the server did not offer", async () => {
    const port = fakeStatementPort();
    const read = await port.read(ID);
    if (read.kind !== "ready") throw new Error("unreachable");
    const narrowed = { ...read, helpKinds: ["proofreading" as const] };
    expect((await saveHelp(port, ID, narrowed, { kind: "none", text: "" })).kind).toBe("rejected");
    expect(port.saved).toEqual([]);
  });

  it("drops the description when the student switches to no human help", () => {
    const next = withKind({ kind: "content", text: "Izmišljeni opis pomoći" }, "none");
    expect(next).toEqual({ kind: "none", text: "" });
    expect(helpValid(next)).toBe(true);
    expect(withKind({ kind: "content", text: "Opis" }, "other")).toEqual({ kind: "other", text: "Opis" });
  });

  it("keeps an unsaved draft when the view is read again after an upload", async () => {
    const port = fakeStatementPort();
    await saveHelp(port, ID, await port.read(ID), { kind: "proofreading", text: "Spremljeni opis" });
    const draft = { kind: "content" as const, text: "Nespremljena izmjena" };
    expect(helpAfterRead(draft, await port.read(ID))).toBe(draft);
    expect(helpAfterRead(null, await port.read(ID))).toEqual({ kind: "proofreading", text: "Spremljeni opis" });
  });

  it("starts an unsaved statement on a kind the server offers", async () => {
    const read = await fakeStatementPort().read(ID);
    if (read.kind !== "ready") throw new Error("unreachable");
    expect(helpAfterRead(null, read)).toEqual({ kind: "none", text: "" });
    expect(helpAfterRead(null, { ...read, helpKinds: ["proofreading", "other"] })).toEqual({ kind: "proofreading", text: "" });
    expect(helpAfterRead(null, { kind: "unavailable" })).toBeNull();
  });

  it("is read only after submission: nothing is sent", async () => {
    const port = fakeStatementPort();
    port.submit();
    const read = await port.read(ID);
    expect(isReadOnly(read)).toBe(true);
    expect((await saveHelp(port, ID, read, { kind: "none", text: "" })).kind).toBe("rejected");
    expect((await attachFile(port, ID, read, file("a.pdf", "application/pdf"))).kind).toBe("readOnly");
    expect(port.saved).toEqual([]);
    expect(port.attached).toEqual([]);
  });
});
