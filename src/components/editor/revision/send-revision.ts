import { REVISION_TEXT_MAX } from "@/domain/collaboration/revision-input";

/**
 * "Pošalji doradu" (E 3.3): the summary the student sees before sending and the
 * check of the optional message. The sent snapshot is a separate record, never
 * a mark in the document. Assumption (WEB-8C): the send goes through the
 * injected `post` as `{ action: "send", documentId, message }`.
 */
export type SendSummary = { textChanged: boolean; resolved: number; stillOpen: number };

export function buildSend(documentId: string, message: string):
  { ok: true; body: { documentId: string; message: string } } | { ok: false; error: "tooLong" } {
  const text = message.normalize("NFC").trim();
  if ([...text].length > REVISION_TEXT_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, body: { documentId, message: text } };
}

export type SendOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "unavailable";

export async function sendRevision(
  body: { documentId: string; message: string },
  post: (body: { action: "send"; documentId: string; message: string }) => Promise<number | null>,
  current: () => boolean = () => true,
): Promise<SendOutcome> {
  if (!current()) return "signedOut";
  const status = await post({ action: "send", ...body });
  if (status === 200 || status === 201) return "ok";
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "unavailable";
}
