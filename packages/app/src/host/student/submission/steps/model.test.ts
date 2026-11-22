import { describe, expect, it } from "vitest";

import { stepsText } from "./messages.hr";
import { pathOf, stepPanelOf, type StepWork } from "./model";

const ready = (workState: string): StepWork => ({ kind: "ready", course: "Uvod u povijest umjetnosti", title: "Seminarski rad 1", workState });

describe("stepPanelOf (E-8, E-9)", () => {
  it("an unreadable state is an error, never a claim about the work", () => {
    expect(stepPanelOf({ kind: "unavailable" })).toEqual({ kind: "error" });
  });
  it("a work not started shows the not-started panel", () => {
    expect(stepPanelOf(ready("not_started"))).toEqual({ kind: "notStarted" });
  });
  it("a submitted work shows the submitted panel", () => {
    expect(stepPanelOf(ready("submitted"))).toEqual({ kind: "submitted" });
  });
  it("a work in progress is the ordinary step", () => {
    expect(stepPanelOf(ready("in_progress"))).toEqual({ kind: "normal" });
  });
});

describe("pathOf", () => {
  it("joins course and title", () => {
    expect(pathOf(ready("in_progress"), stepsText.pathSeparator)).toBe("Uvod u povijest umjetnosti · Seminarski rad 1");
  });
  it("is empty without a checked work", () => {
    expect(pathOf({ kind: "unavailable" }, stepsText.pathSeparator)).toBe("");
  });
});
