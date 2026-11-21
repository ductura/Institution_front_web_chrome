import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { checkPrintout, type AttachmentLimits } from "./statement";

const limits: AttachmentLimits = { allowedFormats: [{ mimeType: "application/pdf", extension: ".pdf" }], maxBytes: 100 };

describe("statement client (WEB-1503)", () => {
  it("checks format, then size, then emptiness", () => {
    expect(checkPrintout({ name: "a.PDF", type: "application/pdf", size: 10 }, limits).kind).toBe("ok");
    expect(checkPrintout({ name: "a.exe", type: "application/pdf", size: 10 }, limits).kind).toBe("format");
    expect(checkPrintout({ name: "a.pdf", type: "application/pdf", size: 101 }, limits).kind).toBe("tooLarge");
    expect(checkPrintout({ name: "a.pdf", type: "application/pdf", size: 0 }, limits).kind).toBe("empty");
  });

  it("no direct API call in the statement files", () => {
    const root = new URL("../../", import.meta.url);
    const files = [
      "src/client/statement.ts",
      "packages/app/src/host/student/statement/StudentStatement.tsx",
      "packages/app/src/host/student/statement/model.ts",
      "packages/app/src/host/student/statement/messages.hr.ts",
    ];
    for (const file of files) expect(readFileSync(new URL(file, root), "utf8"), file).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|EventSource|WebSocket|Worker)\b|\/api\b|@ductura\/(contracts|test-fakes)/);
  });
});
