/**
 * In-app notification settings (M11.5, SRV-1701) behind a port. The server
 * contract for them is not in `@ductura/contracts` yet, so the app uses
 * `unavailableNotificationSettings`: the page says the settings are not
 * available and sends nothing. `createFakeNotificationSettings` is the
 * in-memory stand-in the tests use. When SRV-1701 publishes its route, a port
 * over `src/client` replaces the unavailable one; the page does not change.
 *
 * Only in-app notifications: no email before a provider and a DPA (D-241).
 * The kinds are the first cut of the plan (comment, new assignment version,
 * recorded submission).
 */
export const NOTIFICATION_KINDS = ["comment", "assignmentVersion", "submission"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationSettings = Readonly<Record<NotificationKind, boolean>>;

export type SettingsRead = { readonly kind: "ready"; readonly settings: NotificationSettings } | { readonly kind: "unavailable" };
export type SettingsSave = { readonly kind: "saved"; readonly settings: NotificationSettings } | { readonly kind: "failed" };

export type NotificationSettingsPort = {
  read(): Promise<SettingsRead>;
  save(settings: NotificationSettings): Promise<SettingsSave>;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { comment: true, assignmentVersion: true, submission: true };

export const unavailableNotificationSettings: NotificationSettingsPort = {
  read: async () => ({ kind: "unavailable" }),
  save: async () => ({ kind: "failed" }),
};

/** Only the known kinds, each a boolean; anything else is refused. */
export function parseNotificationSettings(value: unknown): NotificationSettings | null {
  if (value === null || typeof value !== "object") return null;
  const keys = Object.keys(value);
  if (keys.length !== NOTIFICATION_KINDS.length || !NOTIFICATION_KINDS.every((k) => typeof (value as Record<string, unknown>)[k] === "boolean")) return null;
  const record = value as Record<NotificationKind, boolean>;
  return { comment: record.comment, assignmentVersion: record.assignmentVersion, submission: record.submission };
}

export function createFakeNotificationSettings(initial: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS, failSaves = false): NotificationSettingsPort & { readonly saved: () => NotificationSettings } {
  let current = initial;
  return {
    read: async () => ({ kind: "ready", settings: current }),
    save: async (settings) => {
      const parsed = parseNotificationSettings(settings);
      if (failSaves || parsed === null) return { kind: "failed" };
      current = parsed;
      return { kind: "saved", settings: current };
    },
    saved: () => current,
  };
}
