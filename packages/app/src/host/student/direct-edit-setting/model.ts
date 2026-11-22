// Pure rules of the student's direct-edit setting (WEB-1703; plan M6.4, D-34). The student
// allows and revokes the teacher's direct edits on one work; the mark is shown to both roles.
// A change counts as recorded only when the server's answer names the new state (B-6).
// port.ts is the real DirectEditPort over work.direct-edit.get/put; fake-port.ts stands in for
// it in the tests of both roles.
import { directEditSettingMessages as text } from "./messages.hr";

export type DirectEditState = { readonly enabled: boolean; readonly changedAt: string | null };

export type DirectEditRead =
  | { readonly kind: "ready"; readonly state: DirectEditState }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type DirectEditWrite =
  | { readonly kind: "recorded"; readonly state: DirectEditState }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

/** A work is named by its document (the routes' documentId). */
export interface DirectEditPort {
  read(documentId: string): Promise<DirectEditRead>;
  write(documentId: string, enabled: boolean): Promise<DirectEditWrite>;
}

export type SettingShown =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "ready"; readonly state: DirectEditState };

/**
 * What the setting shows after a change: the server's state when it recorded one, otherwise
 * what was shown before. A revocation reads "off" only once the server has confirmed it.
 */
export function afterChange(shown: SettingShown, result: DirectEditWrite): SettingShown {
  return result.kind === "recorded" ? { kind: "ready", state: result.state } : shown;
}

/** The label both roles see on the work. */
export function directEditBadge(enabled: boolean): string {
  return enabled ? text.badgeOn : text.badgeOff;
}

/**
 * Sends a change and accepts it only when the answer carries the requested state.
 * A recorded answer with the other state is treated as unknown: the setting may be either.
 */
export async function changeDirectEdit(
  port: DirectEditPort,
  documentId: string,
  enabled: boolean,
): Promise<DirectEditWrite> {
  let result: DirectEditWrite;
  try {
    result = await port.write(documentId, enabled);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "recorded" && result.state.enabled !== enabled) return { kind: "unknown" };
  return result;
}

/** The sentence announced after a change. */
export function changeMessage(result: DirectEditWrite, enabled: boolean): string {
  switch (result.kind) {
    case "recorded": return enabled ? text.enabledDone : text.revokedDone;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}
