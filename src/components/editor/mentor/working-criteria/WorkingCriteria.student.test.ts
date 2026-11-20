import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B-9: the criteria are the teacher's working note. Neither the component nor
 * the client module is reachable from anything the student's work page loads,
 * so the student's view has no component and sends no request for them.
 */
const SRC = resolve(import.meta.dirname, "../../../..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === "node_modules" ? [] : files(path)) : [path];
  });
const code = (path: string) => /\.(?:ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path);

describe("working criteria stay out of the student's view", () => {
  const importers = files(SRC).filter(code).filter((p) => !p.includes("/working-criteria/") && !p.endsWith("teacher-working-criteria.ts"))
    .filter((p) => /working-criteria|WorkingCriteria|teacher-working-criteria/.test(readFileSync(p, "utf8")));
  it("is imported by no student file, nor by the editor page", () => {
    const bad = importers.filter((p) => /\/components\/student\/|\/app\/(?:zadaci|upis|rad)\/|EditorPage|CommentPanel|SidePanels|RevisionPanel/.test(p));
    expect(bad).toEqual([]);
  });
  it("the student's work page code names neither the routes nor the module", () => {
    for (const p of files(join(SRC, "components/student")).filter(code)) {
      expect(readFileSync(p, "utf8")).not.toMatch(/working-criteri|WorkingCriteri/);
    }
  });
});
