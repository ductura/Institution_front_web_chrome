// DAN-886: razvojni editor nakon HTTP uspjeha memorijskog API-ja ne tvrdi
// „Spremljeno”. Memorijski poslužitelj tekst drži samo do ponovnog pokretanja.
// Negativni slučaj ide prvi. Tekst je izmišljen.
import { test, expect } from '@playwright/test';

const RECEIVED = 'Razvojni poslužitelj primio je tekst · ne čuva se nakon ponovnog pokretanja';

// Bilježi svaki tekst statusa, da se vidi i ono što je bilo samo trenutak.
async function recordStatus(page) {
  await page.addInitScript(() => {
    window.__statusSeen = [];
    new MutationObserver(() => {
      const s = document.getElementById('status');
      if (s && s.textContent) window.__statusSeen.push(s.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}
const seen = (page) => page.evaluate(() => window.__statusSeen);

test('negativno: odbijen PUT nikad ne prikazuje stanje primitka', async ({ page }) => {
  await recordStatus(page);
  await page.route('**/api/documents/demo-1', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.fallback());
  await page.goto('/#/doc/demo-1');
  await page.getByLabel('Sadržaj').fill(`Izmišljeni tekst ${Date.now()}`);
  await expect(page.getByRole('status')).toHaveText('Greška pri spremanju');
  expect(await seen(page)).not.toContain(RECEIVED);
});

test('nakon HTTP uspjeha status ne sadrži „Spremljeno”', async ({ page }) => {
  await recordStatus(page);
  await page.goto('/#/doc/demo-1');
  const ok = page.waitForResponse((r) => r.request().method() === 'PUT' && r.status() === 200);
  await page.getByLabel('Sadržaj').fill(`Izmišljeni tekst ${test.info().project.name} ${Date.now()}`);
  await ok;
  const status = page.getByRole('status');
  await expect(status).toHaveText(RECEIVED);
  await expect(status).not.toHaveText(/(?<!\p{L})spremljen/iu);
  for (const t of await seen(page)) expect(t).not.toMatch(/(?<!\p{L})spremljen/iu);
});
