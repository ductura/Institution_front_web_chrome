// ED-16 (NF2-P14): "Povijest i usporedba" has one dialog and several ways in (the header button,
// the view menu, Ctrl+K and the left panel). They ask through this event; the host that knows the
// document answers it, so none of the entries needs the document id.
export const WORK_HISTORY_EVENT = "ductura:work-history";

/** Asks the page's history dialog to open; false when no host took it. */
export function requestWorkHistory(target: EventTarget = document): boolean {
  return !target.dispatchEvent(new Event(WORK_HISTORY_EVENT, { cancelable: true }));
}

let hosts = 0;
/** A host that can answer (its document is known) says so; the returned function takes it back. */
export function offerWorkHistory(): () => void {
  hosts += 1;
  let taken = false;
  return () => { if (!taken) { taken = true; hosts -= 1; } };
}
/** True while some host on the page can open the dialog; entries without one are not offered. */
export const workHistoryOffered = () => hosts > 0;
