import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';

import { expect, test, type Response } from '@playwright/test';

import { canonicalizeJcs } from '../../packages/editor-core/src/document/forensics/jcs';
import { webOrigin } from './stog';
import { openDemoWork, signInDemoStudent } from './student';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const RECEIPT_SCHEMA = 'ductus-submission-receipt-v2';

type ReceiptKey = {
  keyId: string;
  keyVersion: string;
  evidenceDomainId: string;
  keyBase64Url: string;
};

function isPost(response: Response, url: string) {
  return response.url() === url && response.request().method() === 'POST';
}

async function expectHttp200(response: Response, operation: string) {
  if (response.status() === 200) return;
  const error = await response.json().catch(() => null);
  const detail = [error?.status, error?.stage, error?.reason]
    .filter((value) => typeof value === 'string').join(', ');
  expect(response.status(), `${operation}: HTTP ${response.status()}${detail ? ` (${detail})` : ''}`).toBe(200);
}

test('INT-03: student sinkronizira odlomke, potvrdi Izjavu i preda rad', async ({ page, baseURL = webOrigin }) => {
  const runId = randomUUID();
  const paragraphs = [
    `U izmišljenom vrtu kompostiramo lišće (${runId}).`,
    `U drugom odlomku pratimo promjene u kompostu (${runId}).`,
  ] as const;
  const editor = page.getByRole('textbox', { name: 'Tekst rada', exact: true });
  const statusBar = page.locator('footer[aria-label="Stanje rada"]');

  const workPath = await test.step('Prijava preko AAI@EduHr i otvaranje rada iz seeda', async () => {
    await signInDemoStudent(page, baseURL);
    const path = await openDemoWork(page, baseURL);
    await expect(editor, 'Za predaju treba uređiv rad iz svježeg lokalnog seeda.').toBeEditable();
    return path;
  });
  const assignmentId = workPath.slice('/rad/'.length);
  const submissionPath = `${workPath}/predaja`;

  const revision = await test.step('Upis dvaju odlomaka i potvrda spremanja te snimke', async () => {
    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    const [commit] = await Promise.all([
      page.waitForResponse((response) => {
        if (!isPost(response, `${baseURL}/api/v1/evidence/commit`) || [202, 426].includes(response.status())) {
          return false;
        }
        const document = response.request().postDataJSON()?.document;
        if (typeof document !== 'string') return false;
        const snapshot = Buffer.from(document, 'base64').toString('utf8');
        return paragraphs.every((paragraph) => snapshot.includes(paragraph));
      }, { timeout: 30_000 }),
      (async () => {
        for (const paragraph of paragraphs) {
          await page.keyboard.press('Enter');
          await page.keyboard.insertText(paragraph);
        }
      })(),
    ]);
    await expectHttp200(commit, 'Spremanje obaju odlomaka');
    const saved = await commit.json();
    expect(saved).toMatchObject({ status: 'committed' });
    expect(Number.isSafeInteger(saved.revision)).toBe(true);
    expect(saved.revision).toBeGreaterThan(0);
    await expect(statusBar.getByRole('status')).toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
    return saved.revision as number;
  });

  const work = await test.step('Potvrda Izjave i pregled spremljenih odlomaka prije predaje', async () => {
    await page.getByRole('link', { name: 'Predaja rada', exact: true }).click();
    await expect(page).toHaveURL(`${submissionPath}/izjava`);
    await expect(page.getByRole('heading', { name: 'Izjava', exact: true })).toBeVisible();
    const next = page.getByRole('button', { name: 'Dalje', exact: true });
    await expect(next).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Potvrđujem izjavu' }).check();
    await next.click();
    await expect(page.getByRole('heading', { name: 'Prije predaje', exact: true })).toBeVisible();
    await expect(page.getByText('Potvrđena.', { exact: true })).toBeVisible();

    const [opened] = await Promise.all([
      page.waitForResponse((response) => isPost(response, `${baseURL}/api/v1/evidence/open`)
        && response.request().postDataJSON()?.assignmentId === assignmentId),
      page.getByRole('button', { name: 'Dalje na predaju', exact: true }).click(),
    ]);
    await expectHttp200(opened, 'Čitanje spremljene revizije za predaju');
    const body = await opened.json();
    expect(body).toMatchObject({ status: 'opened', submitted: false, currentRevision: revision });

    const manuscript = page.getByRole('document', { name: 'Tekst koji predajete', exact: true });
    for (const paragraph of paragraphs) {
      await expect(manuscript.locator('p').filter({ hasText: paragraph })).toHaveText(paragraph);
    }
    return body;
  });

  const receipt = await test.step('Predaja spremljene revizije i provjera Ed25519 potpisa potvrde', async () => {
    await page.getByRole('button', { name: 'Predaj rad', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Predati rad?', exact: true });
    const [submitted] = await Promise.all([
      page.waitForResponse((response) => isPost(response, `${baseURL}/api/v1/submission`)),
      dialog.getByRole('button', { name: 'Predaj rad', exact: true }).click(),
    ]);
    await expectHttp200(submitted, 'Predaja rada');
    expect(submitted.request().postDataJSON()).toEqual({ documentId: work.documentId, revision });
    const body = await submitted.json();
    expect(body).toMatchObject({
      status: 'submitted',
      receipt: {
        payload: {
          receiptSchema: RECEIPT_SCHEMA,
          assignmentId,
          documentId: work.documentId,
          revision,
          artifactSha256: work.documentHash,
          evidenceHeadSegmentHash: work.headSegmentHash,
        },
        signature: { algorithm: 'Ed25519', signatureEncoding: 'raw' },
      },
    });
    const { payload, payloadDigestSha256, signature } = body.receipt;
    expect(payload.artifactSha256).toMatch(SHA256_HEX);
    const digest = createHash('sha256').update(canonicalizeJcs(payload)).digest();
    expect(payloadDigestSha256).toBe(digest.toString('hex'));
    const key = (work.receiptKeys as ReceiptKey[]).find((entry) => entry.keyId === signature.keyId
      && entry.keyVersion === signature.keyVersion && entry.evidenceDomainId === payload.evidenceDomainId);
    if (!key) throw new Error('Poslužitelj nije vratio javni ključ potpisa za ovu domenu evidencije.');
    const publicKey = createPublicKey({ key: Buffer.from(key.keyBase64Url, 'base64url'), format: 'der', type: 'spki' });
    const signed = Buffer.concat([Buffer.from(`${RECEIPT_SCHEMA}\n`), digest]);
    expect(verify(null, signed, publicKey, Buffer.from(signature.signatureBase64Url, 'base64url'))).toBe(true);
    return body.receipt;
  });

  await test.step('Potvrda predaje i isti otisak u sučelju', async () => {
    await expect(page).toHaveURL(`${submissionPath}/potvrda`);
    await expect(page.getByRole('heading', { name: 'Potvrda predaje', exact: true })).toBeVisible();
    const fingerprint = page.locator('code').filter({ hasText: new RegExp(`^${receipt.payload.artifactSha256}$`) });
    // Prijavi izostanak otiska i svejedno provjeri zaključavanje rada.
    await expect.soft(fingerprint).toBeVisible();
  });

  await test.step('Ponovno otvaranje rada dopušta samo čitanje', async () => {
    await page.goto(workPath);
    await expect(page).toHaveURL(workPath);
    await expect(statusBar.getByText('Samo za čitanje', { exact: true })).toBeVisible();
    await expect(editor.and(page.locator('[contenteditable="true"]'))).toHaveCount(0);

    const stored = await page.request.get(`/api/v1/student/assignments/${assignmentId}/submission`);
    await expect(stored).toBeOK();
    expect(await stored.json()).toEqual({ state: 'potvrdeno', receipt });
  });
});
