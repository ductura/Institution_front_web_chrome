import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { oidcOrigin } from './stog';

test('VS-1: student se prijavi, spremi rečenicu i vidi je nakon osvježavanja', async ({ page, baseURL }) => {
  const sentence = `U izmišljenom vrtu nastaje kompost (VS-1 ${randomUUID()}).`;
  const editor = page.getByRole('textbox', { name: 'Tekst rada', exact: true });

  await test.step('Prijava kao demo-student preko simulatora AAI@EduHr', async () => {
    await page.goto('/prijava?returnTo=%2Fzadaci');
    await page.getByRole('link', { name: 'Prijava sustavom AAI@EduHr', exact: true }).click();
    await expect(page).toHaveURL((url) => url.origin === oidcOrigin);
    await page.locator('button[name="account"][value="demo-student"]').click();
    await expect(page).toHaveURL(`${baseURL}/zadaci`);

    const me = await page.request.get('/api/v1/me');
    await expect(me).toBeOK();
    expect(await me.json()).toMatchObject({ role: 'student' });
  });

  await test.step('Otvori rad iz lokalnog seeda', async () => {
    await page.getByRole('link', { name: /Seminarski rad: kućno kompostiranje/ }).click();
    await expect(page).toHaveURL((url) => url.origin === baseURL && /^\/rad\/[^/]+$/.test(url.pathname));
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
    expect(commit.status(), 'HTTP odgovor za spremanje rečenice').toBe(200);
    const saveState = page.locator('footer[aria-label="Stanje rada"]').getByRole('status');
    await expect(saveState).toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
  });

  await test.step('Osvježi stranicu i provjeri spremljenu rečenicu', async () => {
    await page.reload();
    await expect(editor).toContainText(sentence);
  });
});
