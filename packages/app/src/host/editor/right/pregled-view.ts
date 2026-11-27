// ED-71 and ED-82: something outside the Pregled group asks it for one of its views: "Prikaz › Prvi
// redovi" (prototype `firstLines`) for Nacrt, a hint in the text ("Otvori pojmovnik") for Pojmovnik.
// The group is opened with requestPanel("review"); this event then picks the view inside it. The group
// may not be mounted yet when the panel opens, so the last request also waits here until it is read.

export type PregledView = "nacrt" | "pojmovnik" | "provjere";

export const PREGLED_VIEW_EVENT = "ductura:pregled-view";

const VIEWS: readonly PregledView[] = ["nacrt", "pojmovnik", "provjere"];
let pending: PregledView | null = null;

/** Asks the Pregled group of this page to show `view`, now or when it is next shown. */
export function requestPregledView(view: PregledView, target: EventTarget = document): void {
  pending = view;
  target.dispatchEvent(new CustomEvent(PREGLED_VIEW_EVENT, { detail: view }));
}

/** The view an event asks for; anything else asks for nothing. */
export function requestedPregledView(event: Event): PregledView | null {
  const detail = (event as CustomEvent<unknown>).detail;
  return VIEWS.find((view) => view === detail) ?? null;
}

/** The view asked for before the group was shown, read once. */
export function takePregledView(): PregledView | null {
  const view = pending;
  pending = null;
  return view;
}

/** The group's side: `show` is called for each request while it is mounted. */
export function onPregledView(show: (view: PregledView) => void, target: EventTarget = document): () => void {
  const listener = (event: Event) => {
    pending = null;
    const view = requestedPregledView(event);
    if (view) show(view);
  };
  target.addEventListener(PREGLED_VIEW_EVENT, listener);
  return () => target.removeEventListener(PREGLED_VIEW_EVENT, listener);
}
