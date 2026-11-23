import { describe, expect, it, vi } from "vitest";

import { createRhythmRecorder, type RhythmPayload, type RhythmPort } from "../../../client/input-rhythm";
import { createFakeRhythmPort } from "../../../client/input-rhythm-fake";
import { sendIfOn } from "./useInputRhythm";

// PIL-P1-RITAM-PREKIDAC: a teacher's "off" holds from the moment it is read, before every send.
const PAYLOAD: RhythmPayload = { origins: [], bursts: [{ startedAtMinute: 0, gapsMs: [120, 140] }] };

describe("sending the rhythm only while the switch is on", () => {
  it("sends while on and hands the answer to the recorder", async () => {
    const port = createFakeRhythmPort();
    const seen: boolean[] = [];
    expect(await sendIfOn(port, "doc-1", PAYLOAD, (on) => seen.push(on))).toBe(true);
    expect(port.sent).toEqual([{ documentId: "doc-1", payload: PAYLOAD }]);
    expect(seen).toEqual([true]);
  });

  it("after the teacher turns it off, drops what was measured and records nothing more", async () => {
    const port = createFakeRhythmPort();
    const send = vi.spyOn(port, "send");
    let t = 1_700_000_000_000;
    const recorder = createRhythmRecorder(() => t, true);
    recorder.noteTyped(); t += 100; recorder.noteTyped();
    port.setRecording("doc-1", false);
    const payload = { origins: [], bursts: recorder.take() };
    expect(payload.bursts).toHaveLength(1);
    expect(await sendIfOn(port, "doc-1", payload, (on) => recorder.setEnabled(on))).toBe(false);
    expect(send).not.toHaveBeenCalled();
    t += 100; recorder.noteTyped(); t += 100; recorder.noteTyped();
    expect(recorder.take()).toEqual([]);
  });

  it("negative control: a failed read of the switch sends nothing", async () => {
    const port: RhythmPort = { ...createFakeRhythmPort(), recording: async () => false, send: vi.fn(async () => undefined) };
    expect(await sendIfOn(port, "doc-1", PAYLOAD, () => {})).toBe(false);
    expect(port.send).not.toHaveBeenCalled();
  });
});
