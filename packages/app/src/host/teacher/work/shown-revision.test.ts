// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { TimeMachineVersion, VersionsResult } from "../../../../../../src/client/time-machine";
import { shownRevision, useShownRevision, type VersionsRead } from "./shown-revision";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = "2026-11-03T08:15:00.000Z";
const checkpoint = (revision: number): TimeMachineVersion => ({ kind: "checkpoint", revision, savedMinute: at });
const submission = (revision: number): TimeMachineVersion => ({ kind: "submission", revision, savedMinute: at });

describe("shownRevision", () => {
  it("names the newest submission for the submitted text", () => {
    expect(shownRevision([checkpoint(4), submission(3), checkpoint(3), submission(1), checkpoint(1)], true)).toBe(3);
  });
  it("names the newest saved version for the live text", () => {
    expect(shownRevision([checkpoint(4), submission(3), checkpoint(3)], false)).toBe(4);
  });
  it("names none when it cannot", () => {
    expect(shownRevision([], false)).toBeNull();
    expect(shownRevision([checkpoint(2), checkpoint(1)], true)).toBeNull();
  });
});

type Props = { hash: string | null; submitted: boolean; alive: boolean; enabled?: boolean };
let root: Root | null = null;
let seen: (number | null)[] = [];

function Probe({ hash, submitted, alive, enabled = true, read }: Props & { read: VersionsRead }) {
  seen.push(useShownRevision("d1", hash, submitted, () => alive, enabled, read));
  return null;
}

async function mount(read: VersionsRead, props: Props) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(h(Probe, { ...props, read })));
  return async (next: Props) => act(async () => root!.render(h(Probe, { ...next, read })));
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  seen = [];
  document.body.innerHTML = "";
});

describe("useShownRevision", () => {
  it("reads the versions once the text is on screen and again when it changes", async () => {
    const answers: VersionsResult[] = [
      { kind: "ready", versions: [checkpoint(2), checkpoint(1)] },
      { kind: "ready", versions: [checkpoint(3), checkpoint(2)] },
      { kind: "unavailable" },
      { kind: "ready", versions: [submission(3), checkpoint(3)] },
    ];
    const asked: string[] = [];
    const rerender = await mount(async (documentId) => { asked.push(documentId); return answers.shift()!; },
      { hash: null, submitted: false, alive: true });
    expect(asked).toEqual([]);
    expect(seen.at(-1)).toBeNull();
    await rerender({ hash: "a", submitted: false, alive: true });
    expect(seen.at(-1)).toBe(2);
    await rerender({ hash: "b", submitted: false, alive: true });
    expect(seen.at(-1)).toBe(3);
    // A failed read keeps the last revision of the live text.
    await rerender({ hash: "c", submitted: false, alive: true });
    expect(seen.at(-1)).toBe(3);
    // The submitted text starts unknown, never with the live revision.
    const before = seen.length;
    await rerender({ hash: "c", submitted: true, alive: true });
    expect(seen[before]).toBeNull();
    expect(seen.at(-1)).toBe(3);
    expect(asked).toEqual(["d1", "d1", "d1", "d1"]);
  });

  it("asks nothing once the session has ended or while switched off", async () => {
    const asked: string[] = [];
    const read: VersionsRead = async (documentId) => { asked.push(documentId); return { kind: "ready", versions: [checkpoint(1)] }; };
    const rerender = await mount(read, { hash: "a", submitted: false, alive: false });
    await rerender({ hash: "b", submitted: false, alive: true, enabled: false });
    expect(asked).toEqual([]);
    expect(seen.every((revision) => revision === null)).toBe(true);
  });
});
