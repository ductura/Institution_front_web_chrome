// ED-41 (P2-12): Sitnice are mounted in "Provjere" of the group Pregled, under the review findings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const group = readFileSync(join(import.meta.dirname, "PregledGroup.tsx"), "utf8");

describe("Provjere", () => {
  it("shows the review findings and then Sitnice with the same work and checks", () => {
    expect(group).toMatch(/import \{ TextFixesPanel \} from "[./]+src\/components\/editor\/text-fixes\/TextFixesPanel"/);
    const at = group.indexOf('view === "provjere"');
    const review = group.indexOf("<ReviewPanel editor={editor} documentId={documentId} enabledCheckIds={enabledCheckIds} />", at);
    const fixes = group.indexOf("<TextFixesPanel editor={editor} documentId={documentId} enabledCheckIds={enabledCheckIds} />", at);
    expect(at).toBeGreaterThan(0);
    expect(review).toBeGreaterThan(at);
    expect(fixes).toBeGreaterThan(review);
  });
});
