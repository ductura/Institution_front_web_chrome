// WEB-E2E-OTPORNOST e2e-spremanje-prekid-veze: scenariji otpornosti spremanja
// razvojnog editora. Samo novi testovi; postojeći (editor-persists, dev-save-status)
// ostaju kakvi jesu. Tekst je izmišljen. Stupci matrice dijele memorijski API
// (workers: 1), pa se tekst jedinstveno označava stupcem i vremenom.
import { test, expect } from '@playwright/test';
import {
  RECEIVED, ERROR, editorOf, openEditor, recordActivity, serverContent, syntheticParagraphs,
} from '../support/otpornost.js';

const status = (page) => page.getByRole('status');

async function saveAndReload(page, request, text) {
  await editorOf(page).fill(text);
  await expect(status(page)).toHaveText(RECEIVED);
  expect(await serverContent(request)).toBe(text);
  await page.reload();
  await expect(editorOf(page)).toHaveValue(text);
  expect(await serverContent(request)).toBe(text);
}

test.describe('otpornost spremanja', () => {
  test('1: više odlomaka preživi osvježavanje i jednaki su onima na poslužitelju', async ({ page, request }) => {
    await openEditor(page);
    await saveAndReload(page, request, syntheticParagraphs(test.info().project.name));
  });

  test('2: prekid veze tijekom pisanja ne gubi tekst i ne tvrdi primitak dok je veza prekinuta', async ({ page, context, request }) => {
    const { puts, statuses } = await recordActivity(page);
    await openEditor(page);
    const first = `Prvi dio ${test.info().project.name} ${Date.now()}`;
    await editorOf(page).fill(first);
    await expect(status(page)).toHaveText(RECEIVED);
    const serverBefore = await serverContent(request);
    expect(serverBefore).toBe(first);
    const seenBefore = (await statuses()).length;
    const putsBefore = puts.length;

    await context.setOffline(true);
    const offlineText = `${first}\n\nUnos tijekom prekida veze`;
    await editorOf(page).fill(offlineText);
    await expect(status(page)).toHaveText(ERROR);
    // Dok je veza prekinuta, nijedan prikazani status ne smije tvrditi primitak.
    for (const t of (await statuses()).slice(seenBefore)) expect(t).not.toMatch(RECEIVED);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    // Tekst u polju je netaknut, a poslužitelj ga još nema.
    await expect(editorOf(page)).toHaveValue(offlineText);
    await context.setOffline(false);
    expect(await serverContent(request)).toBe(first);

    const finalText = `${offlineText}\n\nUnos nakon povrata veze`;
    await editorOf(page).fill(finalText);
    await expect(status(page)).toHaveText(RECEIVED);
    expect(await serverContent(request)).toBe(finalText);
    // Svaki poslani PUT nosi cijeli tekst (idempotentno): zadnji je konačni sadržaj,
    // a nijedan ne duplicira dio.
    const sent = puts.slice(putsBefore);
    expect(sent.at(-1).content).toBe(finalText);
    for (const body of sent) expect(body.content.split('Unos nakon povrata veze').length - 1).toBeLessThanOrEqual(1);
    expect(finalText.split('Unos tijekom prekida veze')).toHaveLength(2);

    await page.reload();
    await expect(editorOf(page)).toHaveValue(finalText);
  });

  test('4: isti scenarij na mobilnoj širini, radnje spremanja vidljive', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page);
    const text = syntheticParagraphs(`${test.info().project.name}-mob`);
    await editorOf(page).fill(text);
    await expect(page.getByRole('button', { name: 'Spremi' })).toBeInViewport();
    await expect(status(page)).toBeInViewport();
    await expect(status(page)).toHaveText(RECEIVED);
    // Nema vodoravnog klizanja stranice.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await serverContent(request)).toBe(text);
    await page.reload();
    await expect(editorOf(page)).toHaveValue(text);
    await expect(page.getByRole('button', { name: 'Spremi' })).toBeInViewport();
  });
});
