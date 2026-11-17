// Pomoćne funkcije editora. Čiste funkcije, rade i u pregledniku i u Node testovima.

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); return fn(...args); };
  return wrapped;
}

/** '#/doc/abc' -> { view: 'doc', id: 'abc' }; sve ostalo -> popis */
export function parseRoute(hash = '') {
  const m = String(hash).match(/^#\/doc\/([\w-]+)$/);
  return m ? { view: 'doc', id: m[1] } : { view: 'list' };
}

export function docHref(id) {
  return `#/doc/${encodeURIComponent(id)}`;
}

export function wordCount(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// DAN-886: memorijski API drži tekst samo do ponovnog pokretanja, pa HTTP
// uspjeh ne smije reći „Spremljeno” (PRODUCT §5); kaže tko je tekst primio.
export const LABELS = {
  idle: '',
  dirty: 'Nespremljene izmjene',
  saving: 'Spremanje…',
  received: 'Razvojni poslužitelj primio je tekst · ne čuva se nakon ponovnog pokretanja',
  error: 'Greška pri spremanju',
};
export function saveStatusLabel(state) {
  return Object.hasOwn(LABELS, state) ? LABELS[state] : '';
}

/** Zaslonska tipkovnica je vjerojatno otvorena kad vidljivi dio padne ispod 75 % visine prozora. */
export function isKeyboardOpen(visualHeight, layoutHeight) {
  if (!visualHeight || !layoutHeight) return false;
  return visualHeight / layoutHeight < 0.75;
}
