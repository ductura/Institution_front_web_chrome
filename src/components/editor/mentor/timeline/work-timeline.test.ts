import { describe, expect, it, vi } from "vitest";
import { readMilestones, readRoster, readSlots, timelineEvents, workStatus } from "./work-timeline";

const date = "2026-11-20";
const checkpoint = { kind: "checkpoint", revision: 3, savedMinute: date + "T09:00:00Z" } as const;
const submission = { kind: "submission", revision: 3, savedMinute: date + "T09:10:00Z", afterDeadline: false } as const;
const step = { id: "demo-etapa", title: "Nacrt", description: "", state: "approved", dueAt: date + "T10:00:00+02:00" } as const;
const slot = { id: "demo-termin", state: "confirmed", proposedAt: date + "T08:30:00Z", startsAt: date + "T10:00:00Z" } as const;

describe("WEB-1111 timeline", () => {
  it("chronologically combines actual requests, deadlines, versions and consultation times", () => {
    const events = timelineEvents([step, { ...step, id: "demo-bez-roka", dueAt: null }], [slot], [submission, checkpoint]);
    expect(events.map((event) => event.kind)).toEqual(["milestone", "request", "checkpoint", "submission", "confirmed"]);
    expect(events[0]).toMatchObject({ at: step.dueAt, title: step.title });
    expect(timelineEvents([], [], [])).toEqual([]);
  });

  it("distinguishes a checkpoint, an actual submission and unavailable data", () => {
    expect(workStatus(undefined, { versions: [checkpoint], nextBeforeRevision: null })).toBe("inProgress");
    expect(workStatus(undefined, { versions: [submission, checkpoint], nextBeforeRevision: null })).toBe("submitted");
    expect(workStatus(true, null)).toBe("submitted");
    expect(workStatus(undefined, null)).toBe("unavailable");
  });

  it("uses bodyless, scoped GETs and accepts the server's closed responses", async () => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ milestones: [step] }))
      .mockResolvedValueOnce(Response.json({ slots: [slot] }))
      .mockResolvedValueOnce(Response.json({ students: [] }))
      .mockResolvedValueOnce(Response.json({ slots: [{ ...slot, internalNote: "demo" }] }))
      .mockResolvedValueOnce(Response.json({ students: [] }, { status: 403 }));
    const options = { fetchImpl: transport, baseUrl: "https://demo.example" };
    expect(await readMilestones("demo/rad", options)).toEqual([step]);
    expect(await readSlots("demo/rad", options)).toEqual([slot]);
    expect(await readRoster("demo-kolegij", options)).toEqual([]);
    expect(await readSlots("demo/rad", options)).toBeNull();
    expect(await readRoster("demo-kolegij", options)).toBeNull();
    expect(transport.mock.calls.slice(0, 3).map(([url, init]) => [String(url), init?.method, init?.body])).toEqual([
      ["https://demo.example/api/v1/works/demo%2Frad/milestones", "GET", undefined],
      ["https://demo.example/api/v1/works/demo%2Frad/consultation-slots", "GET", undefined],
      ["https://demo.example/api/v1/teacher/courses/demo-kolegij/students", "GET", undefined],
    ]);
  });
});
