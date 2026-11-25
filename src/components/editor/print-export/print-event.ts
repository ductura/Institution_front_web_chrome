// ED-06 (NF2-P23): "Pregled ispisa" in the toolbar's "Izvezi" menu opens the very print preview the page owns
// (WorkPrintExport in EditorPageWork). The toolbar asks through a cancelable DOM event; the page answers by
// cancelling it, so the toolbar knows whether anyone opened the preview.
export const PRINT_PREVIEW_EVENT = "ductura:print-preview";

/** Asks the page to open its print preview; true when the page answered. */
export function askPrintPreview(target: EventTarget = document): boolean {
  const event = new Event(PRINT_PREVIEW_EVENT, { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}
