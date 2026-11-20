import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { openDemoWork, signInDemoStudent } from './student';
import { webOrigin } from './stog';

test('VS-1: student se prijavi, spremi rečenicu i vidi je nakon osvježavanja', async ({ page, baseURL = webOrigin }) => {
  const sentence = `U izmišljenom vrtu nastaje kompost (VS-1 ${randomUUID()}).`;
  const editor = page.getByRole('textbox', { name: 'Tekst rada', exact: true });

  await test.step('Prijava kao demo-student preko simulatora AAI@EduHr', async () => {
    await signInDemoStudent(page, baseURL);
  });

  await test.step('Otvori rad iz lokalnog seeda', async () => {
    await openDemoWork(page, baseURL);
    await expect(editor).toBeEditable();
  });

  await test.step('Upiši rečenicu i pričekaj potvrdu poslužitelja', async () => {
    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    await page.keyboard.press('Enter');
    const [commit] = await Promise.all([
      page.waitForResponse((response) => {
        if (response.url() !== `${baseURL}/api/v1/evidence/commit` || response.request().method() !== 'POST') {
          return false;
        }
        // Prihvati odgovor za snimku s ovom rečenicom, nakon moguće promjene protokola.
        if (response.status() === 426) return false;
        const snapshot = response.request().postDataJSON()?.document;
        return typeof snapshot === 'string' && Buffer.from(snapshot, 'base64').toString('utf8').includes(sentence);
      }, { timeout: 30_000 }),
      page.keyboard.insertText(sentence),
    ]);
    if (commit.status() !== 200) {
      const failure = await commit.json().catch(() => null);
      const stage = typeof failure?.stage === 'string' ? `, faza ${failure.stage}` : '';
      throw new Error(`Spremanje rečenice nije potvrđeno (HTTP ${commit.status()}${stage}).`);
    }
    const saveState = page.locator('footer[aria-label="Stanje rada"]').getByRole('status');
    await expect(saveState).toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
  });

  await test.step('Osvježi stranicu i provjeri spremljenu rečenicu', async () => {
    await page.reload();
    await expect(editor).toContainText(sentence);
  });
});
