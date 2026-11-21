import { describe, expect, it } from "vitest";

import { createFakeNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, parseNotificationSettings, unavailableNotificationSettings } from "./notification-settings";

describe("notification settings", () => {
  it("are unavailable in the app until the server has their route, and nothing is saved", async () => {
    expect(await unavailableNotificationSettings.read()).toEqual({ kind: "unavailable" });
    expect(await unavailableNotificationSettings.save(DEFAULT_NOTIFICATION_SETTINGS)).toEqual({ kind: "failed" });
  });

  it("read back what was saved in the fake", async () => {
    const port = createFakeNotificationSettings();
    const next = { comment: false, assignmentVersion: true, submission: false };
    expect(await port.save(next)).toEqual({ kind: "saved", settings: next });
    expect(await port.read()).toEqual({ kind: "ready", settings: next });
  });

  it("report a failed save and keep the old value", async () => {
    const port = createFakeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, true);
    expect(await port.save({ comment: false, assignmentVersion: false, submission: false })).toEqual({ kind: "failed" });
    expect(port.saved()).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it.each([
    [null], ["on"], [{ comment: true }], [{ comment: true, assignmentVersion: true, submission: "yes" }],
    [{ comment: true, assignmentVersion: true, submission: true, email: true }],
  ])("refuse %j", (value) => {
    expect(parseNotificationSettings(value)).toBeNull();
  });
});
