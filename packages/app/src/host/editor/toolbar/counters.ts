/**
 * ED-101 (prototype toolbar2.js cntHole, cntCmt, cntSrc, tbSend; INVENTAR-editor 1296-1299): the bar counts what
 * still waits in the text, "Za provjeru", open comments and citations typed as text, and "Pošalji mentoru" lists
 * them before sending. Pure: the marks come from marks-model, nothing here touches the document.
 */
import type { MarkKind, Place } from "../marks/marks-model";
import { toolbarBehaviourHr as hr } from "./messages.hr";

export type CounterId = "cntHole" | "cntCmt" | "cntSrc";
export type Counts = Readonly<Record<CounterId, number>>;

/** The mark kind each counter jumps to (prototype railNext hole, cmt, plain). */
export const COUNTER_KIND: Readonly<Record<CounterId, MarkKind>> = { cntHole: "hole", cntCmt: "cmt", cntSrc: "plain" };
const ORDER: readonly CounterId[] = ["cntHole", "cntCmt", "cntSrc"];

export function countsOf(places: readonly Place[]): Counts {
  const n = (kind: MarkKind) => places.filter((p) => p.kind === kind).length;
  return { cntHole: n("hole"), cntCmt: n("cmt"), cntSrc: n("plain") };
}

/** What "Pošalji mentoru" carries on the bar: everything that waits. */
export const waiting = (c: Counts): number => c.cntHole + c.cntCmt + c.cntSrc;

/** The counters shown on the bar: a counter at zero is left out, as the prototype's `data-zero`. */
export function counterButtons(c: Counts): { id: CounterId; count: number; label: string; tip: string }[] {
  const tips = { cntHole: hr.cntHoleTip, cntCmt: hr.cntCmtTip, cntSrc: hr.cntSrcTip } as const;
  return ORDER.filter((id) => c[id] > 0).map((id) => ({ id, count: c[id], label: hr[id], tip: tips[id] }));
}

/** Croatian plural: 1 komentar, 2 komentara, 5 komentara (one, few, many). */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const ten = n % 10;
  const hundred = n % 100;
  if (ten === 1 && hundred !== 11) return forms[0];
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return forms[1];
  return forms[2];
}

/** The rows of "Prije slanja mentoru"; empty when nothing waits. */
export function sendRows(c: Counts): { id: CounterId; text: string; note: string }[] {
  const forms = { cntHole: hr.sendHole, cntCmt: hr.sendCmt, cntSrc: hr.sendSrc } as const;
  return ORDER.filter((id) => c[id] > 0).map((id) => ({
    id, text: `${c[id]} ${plural(c[id], forms[id])}`, note: id === "cntHole" ? hr.sendNextOne : hr.sendNext,
  }));
}
