import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-D3-NASTAVNIK: the history and the withdrawal switch reach the server only through the transport
// they are given; no source file holds a network primitive, a form or an API URL.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const DIR = import.meta.dirname;

describe("no direct API in the submission history modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(DIR, f));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("the operations are the contract's, and the screens ask only through the call they are given", () => {
    const contract = readFileSync(join(DIR, "contract.ts"), "utf8");
    for (const id of ["teacher.submission-history.get", "teacher.submission-withdrawal.get", "teacher.submission-withdrawal.post"]) {
      expect(contract).toContain(`"${id}"`);
    }
    for (const screen of ["SubmissionHistory.tsx", "WithdrawalSwitch.tsx"]) {
      expect(readFileSync(join(DIR, screen), "utf8")).not.toMatch(/createApi|fake-port/);
    }
  });

  it("the page mounts them over its own transport, never the fake server", () => {
    const page = readFileSync(join(DIR, "../SubmissionsPage.tsx"), "utf8");
    expect(page).toMatch(/historyPort\(call/);
    expect(page).toContain("history={history}");
    expect(page).not.toMatch(/fake-port|fakeHistoryServer/);
  });

  it("the screens use the DataTable, Checkbox and Button of @ductura/ui", () => {
    expect(readFileSync(join(DIR, "SubmissionHistory.tsx"), "utf8")).toMatch(/import \{[^}]*\bDataTable\b[^}]*\} from "@ductura\/ui"/);
    expect(readFileSync(join(DIR, "WithdrawalSwitch.tsx"), "utf8")).toMatch(/import \{[^}]*\bCheckbox\b[^}]*\} from "@ductura\/ui"/);
  });
});
