import { noAccessRoute } from "../../../../../../src/client/session";
import type { StartedWork, StartOutcome } from "../../../../../../src/client/student-work";
import { startWorkText as t } from "./messages.hr";

/**
 * What the card does with the server's answer (WEB-1402). Routes are the app's,
 * under its base; the page turns them into addresses. A started work opens the
 * editor; a refusal goes to the screen of WEB-1401 (404 as "denied", so the
 * screen never says whether the assignment exists); an unacknowledged notice
 * opens the notice first (PRODUCT §5 rule 6); an unknown answer stays on the
 * card with a note, and the next click opens the same work.
 */
export type Step =
  | { readonly kind: "open"; readonly route: string; readonly work: StartedWork }
  | { readonly kind: "leave"; readonly route: string }
  | { readonly kind: "note"; readonly text: string };

/** The card the student started from: where the no-access screen leads back to. */
export const CARD_ROUTE = "/zadaci";

export function stepFor(outcome: StartOutcome, assignmentId: string): Step {
  switch (outcome.kind) {
    case "zapocet":
      return { kind: "open", route: `/rad/${encodeURIComponent(outcome.work.assignmentId)}`, work: outcome.work };
    case "bez-pristupa":
      return { kind: "leave", route: noAccessRoute(outcome.access, CARD_ROUTE) };
    case "nije-pronaden":
      return { kind: "leave", route: noAccessRoute("denied", CARD_ROUTE) };
    case "prvo-obavijest":
      return { kind: "leave", route: `/zadatak/${encodeURIComponent(assignmentId)}` };
    default:
      return { kind: "note", text: t.unknown };
  }
}

/** "Jezik rada: hrvatski" and "Pravila fakulteta: verzija 3", from the server's answer only. */
export function workFacts(work: StartedWork): readonly [string, string] {
  return [
    t.language.replace("{language}", t.languages[work.workLanguage]),
    t.rules.replace("{version}", String(work.facultyRulesVersion)),
  ];
}
