// Pure rules of the student's direct-edit setting (WEB-1703; plan M6.4, D-34). The student
// allows and revokes the teacher's direct edits on one work; the mark is shown to both roles.
// A change counts as recorded only when the server's answer names the new state (B-6).
// No server route exists yet: DirectEditPort is the smallest contract the plan implies, a probe
// answer stands in for it in the tests, and the page that mounts this passes the real port.
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

export interface DirectEditPort {
  read(assignmentId: string): Promise<DirectEditRead>;
  write(assignmentId: string, enabled: boolean): Promise<DirectEditWrite>;
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
  assignmentId: string,
  enabled: boolean,
): Promise<DirectEditWrite> {
  let result: DirectEditWrite;
  try {
    result = await port.write(assignmentId, enabled);
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
