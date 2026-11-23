import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// PIL-P1-PRAGOVI-ADMIN: the thresholds page reaches the server only through src/client (createApi with the
// contract extract), never through a network primitive, an API URL or a form of its own.
it("PIL-P1-PRAGOVI-ADMIN has no network call outside the shared client", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.(tsx?|css)$/.test(file) && !file.endsWith(".test.ts"));
  expect(files).toEqual(expect.arrayContaining(["OriginThresholdsPage.tsx", "contract.ts", "fake-port.ts", "messages.hr.ts"]));
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|["'`]\/?api\/|<form\b/,
    );
  }
});
