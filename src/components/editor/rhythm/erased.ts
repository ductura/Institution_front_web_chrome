// "Obriši zabilježeni ritam" (PIL-P1-RITAM-PREKIDAC) tells the recorder of the same work, in this
// tab, to drop what it measured but has not sent yet, so nothing measured before the delete
// reaches the server after "obrisano". The dialog and the editor host are separate trees.
type Listener = (documentId: string) => void;

const listeners = new Set<Listener>();

/** Called once the server confirmed the delete. */
export function rhythmErased(documentId: string): void {
  for (const listener of [...listeners]) listener(documentId);
}

/** Returns the unsubscribe. */
export function onRhythmErased(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
