/**
 * ED-100 (prototype toolbar2.js cite, menu-ins; INVENTAR-editor 546, 1290): the toolbar's "Navod" and "Novi izvor"
 * open what the sources line under the sheet already has, the citation picker and the quick source dialog. The
 * toolbar and SourcesMention are separate parts of the page, so the toolbar asks here and SourcesMention answers.
 */
export type SourceRequest = "cite" | "newSource";

const listeners = new Set<(request: SourceRequest) => void>();

/** Asks for the picker or the dialog; false when nothing on the page can answer (the toolbar then says so). */
export function requestSourceAction(request: SourceRequest): boolean {
  if (listeners.size === 0) return false;
  for (const listener of [...listeners]) listener(request);
  return true;
}

export function onSourceRequest(listener: (request: SourceRequest) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
