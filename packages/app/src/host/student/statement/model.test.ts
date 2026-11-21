import { describe, expect, it } from "vitest";

import { attachFile, helpValid, isReadOnly, printoutError, saveHelp } from "./model";
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
