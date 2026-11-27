// Pomoćnici za scenarije otpornosti spremanja (e2e/otpornost). Tekst je izmišljen.
import { expect } from '@playwright/test';

export const RECEIVED = /^Razvojni poslužitelj primio je tekst/;
export const ERROR = 'Greška pri spremanju';
export const DOC = 'demo-1';

/** Izmišljeni višeodlomački tekst, jedinstven po stupcu matrice i trenutku. */
export function syntheticParagraphs(label, n = 4) {
  const stamp = `${label} ${Date.now()}`;
  return Array.from({ length: n }, (_, i) => `Odlomak ${i + 1} (${stamp}): izmišljena rečenica broj ${i + 1}.`).join('\n\n');
}

export const editorOf = (page) => page.getByLabel('Sadržaj');

/** Što memorijski API trenutačno drži za dokument. */
export async function serverContent(request, id = DOC) {
  const res = await request.get(`/api/documents/${id}`);
  expect(res.ok()).toBe(true);
  return (await res.json()).content;
}

/** Otvara editor dokumenta i čeka da je upisiv. */
export async function openEditor(page, id = DOC) {
  await page.goto(`/#/doc/${id}`);
  await expect(editorOf(page)).toBeEditable();
}

/** Bilježi svaki tekst statusa i svaki PUT (tijelo), da se vidi i ono što je trajalo trenutak. */
export async function recordActivity(page) {
  await page.addInitScript(() => {
    window.__statusSeen = [];
    new MutationObserver(() => {
      const s = document.getElementById('status');
      if (s && s.textContent) window.__statusSeen.push(s.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const puts = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().includes('/api/documents/')) puts.push(r.postDataJSON());
  });
  return { puts, statuses: () => page.evaluate(() => window.__statusSeen) };
}
