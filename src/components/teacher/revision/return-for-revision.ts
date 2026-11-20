import { REVISION_TEXT_MAX } from "@/domain/collaboration/revision-input";
import { zagrebInstant } from "@/lib/i18n/zagreb";

/**
 * "Vrati na doradu" (E 3.5 mentor2, N-06/07/08, dialog dd-h). The request is a
 * separate record next to the work (ARCHITECTURE 5a): it never touches the
 * document or its hash chain. The deadline is the end of the chosen day in
 * Zagreb time, or null for none.
 *
 * Assumption (WEB-8C): the contract has no "return" action yet, so the client
 * posts `{ action: "return", documentId, instruction, dueAt }` through an
 * injected `post` and the route will adopt this smallest shape.
 */

export type ReturnError = "empty" | "tooLong" | "pastDue";

export type ReturnBody = { documentId: string; instruction: string; dueAt: string | null };

export type ReturnInput = { documentId: string; instruction: string; due: string; today: string };

export function buildReturn(input: ReturnInput): { ok: true; body: ReturnBody } | { ok: false; error: ReturnError } {
  const instruction = input.instruction.normalize("NFC").trim();
  if (instruction === "") return { ok: false, error: "empty" };
  if ([...instruction].length > REVISION_TEXT_MAX) return { ok: false, error: "tooLong" };
  let dueAt: string | null = null;
  if (input.due !== "") {
    if (input.due < input.today) return { ok: false, error: "pastDue" };
    dueAt = zagrebInstant(`${input.due}T23:59`);
    if (dueAt === null) return { ok: false, error: "pastDue" };
  }
  return { ok: true, body: { documentId: input.documentId, instruction, dueAt } };
}

export type ReturnOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "unavailable";

/** `post` answers with the HTTP status, or null when no answer came. */
export type ReturnPost = (body: ReturnBody & { action: "return" }) => Promise<number | null>;

export async function returnForRevision(
  body: ReturnBody, post: ReturnPost, current: () => boolean = () => true,
): Promise<ReturnOutcome> {
  if (!current()) return "signedOut";
  const status = await post({ action: "return", ...body });
  if (status === 200 || status === 201) return "ok";
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "unavailable";
}
