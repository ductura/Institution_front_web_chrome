import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CommentThread } from "../../../../../../src/client/comments.ts";
import type { LiveView } from "../../../../../../src/client/live-reader.ts";

import { commentsWritable, liveFrame, revisionMark, threadData } from "./live-view-model";

const HASH = "3fa91c20" + "0".repeat(56);
const doc = { nodes: [] } as never;
const view = (over: Partial<LiveView>): LiveView =>
  ({ document: doc, hash: HASH, empty: false, connection: "live", submitted: false, ...over });

describe("live view frame", () => {
  it("is read-only in every state: no editing cursor", () => {
    for (const submitted of [false, true]) expect(liveFrame(view({ submitted })).readOnly).toBe(true);
  });
  it("shows a live work as live, with no revision", () => {
    const frame = liveFrame(view({}));
    expect(frame).toMatchObject({ locked: false, statusLabel: "Rad uživo", revisionLabel: null });
  });
  it("shows a submitted work as locked, with its revision mark", () => {
    const frame = liveFrame(view({ submitted: true }));
    expect(frame).toMatchObject({ locked: true, statusLabel: "Predano", revisionLabel: "Revizija 3fa91c20" });
  });
  it("keeps a submitted work submitted through a failed request", () => {
    expect(liveFrame(view({ submitted: true, connection: "retrying" })).locked).toBe(true);
  });
  it("never locks, labels or annotates text that is not shown", () => {
    expect(liveFrame(view({ document: null, submitted: true }))).toMatchObject({ locked: false, noteLabel: null });
  });
  it("takes a revision mark only from a full SHA-256", () => {
    expect(revisionMark("abc")).toBeNull();
    expect(revisionMark(null)).toBeNull();
    expect(revisionMark(HASH)).toBe("3fa91c20");
  });
});

describe("comments on the existing thread", () => {
  const thread: CommentThread = {
    id: "t1", number: 1, state: "resolved", anchor: null,
    comments: [
      { id: "c1", role: "teacher", isOwn: true, body: "Navedi izvor.", createdWindow: "2026-11-12T10:00:00Z", deletedWindow: null },
      { id: "c2", role: "student", isOwn: false, body: null, createdWindow: "2026-11-13T10:00:00Z", deletedWindow: "2026-11-13T11:00:00Z" },
    ],
  };
  it("maps the wave 8 records, keeping a deleted comment in its place", () => {
    const data = threadData(thread);
    expect(data.resolved).toBe(true);
    expect(data.entries.map((e) => [e.author, e.text, e.mentor])).toEqual([
      ["Nastavnik", "Navedi izvor.", true],
      ["Student", "Student je obrisao ovaj komentar.", false],
    ]);
  });
  it("lets the teacher comment on a submitted work, and stops only when nothing is shown", () => {
    expect(commentsWritable("live")).toBe(true);
    expect(commentsWritable("retrying")).toBe(true);
    expect(commentsWritable("signedOut")).toBe(false);
    expect(commentsWritable("notFound")).toBe(false);
  });
});

describe("no direct API", () => {
  it("has no network primitive in the live view files", () => {
    const here = import.meta.dirname;
    const files = readdirSync(here).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
    expect(files).toContain("TeacherLiveView.tsx");
    for (const file of files) {
      const source = readFileSync(join(here, file), "utf8");
      expect(source, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios|\/api\//);
      expect(source, file).not.toMatch(/contentEditable|contenteditable/i);
    }
  });
});
