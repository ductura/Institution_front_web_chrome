// F4-PRE-R02: how many of the student's Asistent conversations go with the declaration, for step 3, step 4
// and PD-3. Read from the server (declaration-v2 and the assistant's list), never from this browser.
// When either read fails the count is unknown (null), which the steps say rather than claiming "none attached".
import { createApi } from "../../../../../../../src/client/api.ts";
import { readConversations, readSecond, type SecondCall } from "../../../../../../../src/client/declaration-attachments.ts";
import { submitText } from "../submit/messages.hr";
import { checksText } from "../summary/messages.hr";

export type AttachedCount = { readonly total: number; readonly attached: number };

/** The count for one assignment; null when either read fails or the client rejects the operation. */
export type AttachedCountRead = (assignmentId: string) => Promise<AttachedCount | null>;

export function attachedCountReader(call: ReturnType<typeof createApi> = createApi()): AttachedCountRead {
  return async (assignmentId) => {
    const [second, list] = await Promise.all([
      readSecond(call as unknown as SecondCall, assignmentId), readConversations(call, assignmentId),
    ]);
    if (second.kind !== "ready" || list.kind !== "ready") return null;
    return { total: list.conversations.length, attached: second.count };
  };
}

/** Step 3's line of the conversations section; unknown is said so, never "none". */
export function conversationsLine(count: AttachedCount | null | "loading"): string {
  if (count === null || count === "loading") return checksText.conversationsUnavailable;
  if (count.total === 0) return checksText.conversationsNone;
  return checksText.conversationsCount.replace("{n}", String(count.total)).replace("{a}", String(count.attached));
}

/** Step 4's row value; null when the row is not shown (no conversations, or the count is unknown). */
export function conversationsRow(count: AttachedCount | null | "loading"): string | null {
  if (count === null || count === "loading" || count.total === 0) return null;
  return submitText.conversationsAttached.replace("{a}", String(count.attached));
}

export const serverAttachedCount: AttachedCountRead = (assignmentId) => attachedCountReader()(assignmentId);
