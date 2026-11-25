// ED-16 (NF2-P14): "Povijest i usporedba" has one dialog and several ways in (the header button,
// the view menu, Ctrl+K and the left panel). They ask through this event; the host that knows the
// document answers it, so none of the entries needs the document id.
export const WORK_HISTORY_EVENT = "ductura:work-history";

/** Asks the page's history dialog to open; false when no host took it. */
export function requestWorkHistory(target: EventTarget = document): boolean {
  return !target.dispatchEvent(new Event(WORK_HISTORY_EVENT, { cancelable: true }));
}
