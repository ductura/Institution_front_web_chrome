// Prijenos Ductus e2e/local-editor.spec.ts (b36c82b9), DAN-755 dio 755-2.
// Ovdje je samo test 14 (axe); ostali traže editor s dnevnikom na uređaju
// (E-0.3), kojeg web još nema. Stupci matrice dijele dokument demo-1, pa
// test ne pretpostavlja početni sadržaj. Tekst je izmišljen.
import { test, expect } from '@playwright/test';
import { axe, axeViolations } from './support/axe.js';

const editorOf = (page) => page.getByLabel('Sadržaj');

async function openEditor(page) {
  await page.goto('/#/doc/demo-1');
  await expect(editorOf(page)).toBeEditable();
}

/** Upisuje tekst i čeka da ga API potvrdi kao spremljen. */
async function typeAndSave(page, text) {
  await editorOf(page).fill(text);
  await expect(editorOf(page)).toHaveValue(text);
  await expect(page.getByRole('status')).toHaveText('Spremljeno');
}

test.describe('local editor (Ductus #197)', () => {
  // Negativni slučaj ide prvi: pomoćnik mora pasti na stvarnom kršenju, inače
  // bi test 14 prošao i nad stranicom koju axe nije pregledao.
  test('harness: axe reports an unlabelled field and an image without alt', async ({ page }) => {
    await openEditor(page);
    await typeAndSave(page, `Izmišljeni tekst ${test.info().project.name} ${Date.now()}`);
    await page.evaluate(() => {
      const main = document.querySelector('main');
      main.append(document.createElement('input'));
      const img = document.createElement('img');
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      main.append(img);
    });
    const ids = (await axeViolations(page)).map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['label', 'image-alt']));
  });

  test('14: axe finds nothing on the ready editor with saved text', async ({ page }) => {
    await openEditor(page);
    await typeAndSave(page, `Pristupačan izmišljeni tekst ${test.info().project.name} ${Date.now()}`);
    await axe(page);
  });
});
