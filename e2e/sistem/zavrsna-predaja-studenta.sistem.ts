import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';

import { expect, test, type Response } from '@playwright/test';

import { canonicalizeJcs } from '../../packages/editor-core/src/document/forensics/jcs';
import { webOrigin } from './stog';
import { UNCONFIRMED_V2, journalHolds, assignmentOf, describePageOnFailure, dismissGuide, openDemoWork, signInDemoStudent } from './student';

describePageOnFailure();

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

test('INT-03: student sinkronizira odlomke, potvrdi Izjavu i preda rad', async ({ page }) => {
  const runId = randomUUID();
  const unconfirmed = `${UNCONFIRMED_V2} (${runId}).`;
  const heldCommits: Array<{ abort: () => Promise<void> }> = [];
  const paragraphs = [
    `U izmišljenom vrtu kompostiramo lišće (${runId}).`,
    `U drugom odlomku pratimo promjene u kompostu (${runId}).`,
  ] as const;
  const editor = page.getByRole('textbox', { name: 'Tekst rada', exact: true });
  const statusBar = page.locator('footer[aria-label="Stanje rada"]');

  const workPath = await test.step('Prijava preko AAI@EduHr i otvaranje rada iz seeda', async () => {
    await signInDemoStudent(page);
    const path = await openDemoWork(page);
    await expect(editor, 'Za predaju treba uređiv rad iz svježeg lokalnog seeda.').toBeEditable();
    return path;
  });
  const assignmentId = assignmentOf(workPath);
  const submissionPath = `${workPath}/predaja`;

  const savedWork = await test.step('Upis dvaju odlomaka i potvrda spremanja te snimke', async () => {
    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    const [commit] = await Promise.all([
      page.waitForResponse((response) => {
        if (!isPost(response, `${webOrigin}/api/v1/evidence/commit`) || [202, 426].includes(response.status())) {
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
    const request = commit.request().postDataJSON();
    const saved = await commit.json();
    expect(saved).toMatchObject({
      status: expect.stringMatching(/^(committed|duplicate)$/),
      receipt: {
        status: 'signed',
        signedReceipt: {
          payload: {
            documentId: request.documentId,
            clientTransactionId: request.clientTransactionId,
            revision: saved.revision,
            segmentHash: expect.stringMatching(SHA256_HEX),
          },
        },
      },
    });
    expect(Number.isSafeInteger(saved.revision)).toBe(true);
    expect(saved.revision).toBeGreaterThan(0);
    await expect(statusBar.getByRole('status')).toHaveText('Spremljeno na poslužitelju', { timeout: 30_000 });
    return {
      revision: saved.revision as number,
      documentId: request.documentId as string,
      documentHash: createHash('sha256').update(Buffer.from(request.document, 'base64')).digest('hex'),
      headSegmentHash: saved.receipt.signedReceipt.payload.segmentHash as string,
    };
  });
  const { revision } = savedWork;

  await test.step('INT-14: lokalna verzija V2 ostaje na uređaju jer poslužitelj ne odgovara', async () => {
    // The commit of V2 reaches the network, but its answer never comes back (A08, N03): the device
    // keeps V2, the server keeps V1. The held requests are aborted once the work is submitted.
    await page.route(`${webOrigin}/api/v1/evidence/commit`, async (route) => {
      heldCommits.push(route);
    });
    const [held] = await Promise.all([
      page.waitForRequest((request) => request.url() === `${webOrigin}/api/v1/evidence/commit`
        && request.method() === 'POST', { timeout: 30_000 }),
      (async () => {
        await editor.click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText(unconfirmed);
      })(),
    ]);
    const document = held.postDataJSON()?.document;
    if (typeof document === 'string') {
      expect(Buffer.from(document, 'base64').toString('utf8')).toContain(UNCONFIRMED_V2);
    }
    await expect(editor).toContainText(unconfirmed);
    // While the commit is held the chip says "Sprema se…"; the device's journal is the evidence.
    await expect.poll(() => journalHolds(page, unconfirmed), { message: 'V2 u lokalnom dnevniku (IndexedDB)' }).toBe(true);
  });

  const work = await test.step('Potvrda Izjave i pregled spremljenih odlomaka prije predaje', async () => {
    await dismissGuide(page);
    // At 1280×720 the editor's toolbar lies over the top bar's "Predaja rada" and takes the pointer
    // (open finding in the PR); the link is opened from the keyboard, as a keyboard user does.
    await page.getByRole('link', { name: 'Predaja rada', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${submissionPath}/izjava`);
    await expect(page.getByRole('heading', { name: 'Izjava', exact: true })).toBeVisible();
    const next = page.getByRole('button', { name: 'Dalje', exact: true });
    await expect(next).toBeDisabled();
    // PIL-K-IZJAVA: the declaration is filled and saved on the server before it can be confirmed.
    await page.getByRole('link', { name: /^(Ispuni|Uredi) izjavu$/ }).click();
    await page.getByRole('button', { name: 'Spremi izjavu' }).click();
    await expect(page.getByText('Izjava o pomoći je spremljena na poslužitelju.')).toBeVisible();
    const confirmBox = page.getByRole('checkbox', { name: 'Potvrđujem izjavu' });
    await expect(confirmBox).toBeEnabled();
    // Checked only once the server holds the confirmation (no optimistic tick).
    await confirmBox.click();
    await expect(confirmBox).toBeChecked();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page).toHaveURL((url) => url.pathname === `${submissionPath}/pregled`);
    await expect(page.getByRole('heading', { name: 'Prije predaje', exact: true })).toBeVisible();
    await expect(page.getByText('Potvrđena', { exact: true })).toBeVisible();

    // packages/app reads the server's revision on step 4 ("slanje"), where the text is submitted.
    const [opened] = await Promise.all([
      page.waitForResponse((response) => isPost(response, `${webOrigin}/api/v1/evidence/open`)
        && response.request().postDataJSON()?.assignmentId === assignmentId),
      page.getByRole('button', { name: 'Dalje', exact: true }).click(),
    ]);
    await expect(page).toHaveURL((url) => url.pathname === `${submissionPath}/slanje`);
    await expectHttp200(opened, 'Čitanje spremljene revizije za predaju');
    const body = await opened.json();
    expect(body).toMatchObject({
      status: 'opened',
      submitted: false,
      currentRevision: revision,
      documentId: savedWork.documentId,
      documentHash: savedWork.documentHash,
      headSegmentHash: savedWork.headSegmentHash,
    });

    // The step shows the words of the text it submits, not the text: both paragraphs are in the server's
    // snapshot it read, and the hash of those bytes is the saved one.
    const snapshot = Buffer.from(body.document, 'base64');
    expect(createHash('sha256').update(snapshot).digest('hex')).toBe(savedWork.documentHash);
    for (const paragraph of paragraphs) expect(snapshot.toString('utf8')).toContain(paragraph);
    expect(snapshot.toString('utf8'), 'INT-14: predaja čita potvrđeni V1, ne lokalni V2').not.toContain(UNCONFIRMED_V2);
    await expect(page.getByRole('heading', { name: 'Predati rad?', exact: true })).toBeVisible();
    return body;
  });

  const receipt = await test.step('Predaja spremljene revizije i provjera Ed25519 potpisa potvrde', async () => {
    await page.getByRole('button', { name: 'Predaj rad', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Predati rad?', exact: true });
    // INT-16: with a newer local version the app may warn first; the test keeps the confirmed V<n>.
    const keepConfirmed = page.getByRole('button', { name: `Predaj potvrđenu verziju V${revision}`, exact: true });
    await keepConfirmed.waitFor({ state: 'visible', timeout: 3_000 }).then(() => keepConfirmed.click(), () => undefined);
    const [submitted] = await Promise.all([
      page.waitForResponse((response) => isPost(response, `${webOrigin}/api/v1/submission`)),
      (async () => {
        await dialog.getByRole('button', { name: 'Predaj rad', exact: true }).click();
        await keepConfirmed.waitFor({ state: 'visible', timeout: 3_000 }).then(() => keepConfirmed.click(), () => undefined);
      })(),
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
          artifactSha256: savedWork.documentHash,
          evidenceHeadSegmentHash: savedWork.headSegmentHash,
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

  await test.step('Potvrda predaje prikazuje isti otisak i nakon osvježavanja', async () => {
    await expect(page).toHaveURL((url) => url.pathname === `${submissionPath}/potvrda`);
    // E-11: the fingerprint in groups of four characters (receipt/model.ts fingerprintGroups).
    const grouped = receipt.payload.artifactSha256.match(/.{4}/g).join(' ');
    await expect(page.getByRole('heading', { name: /^Predano / })).toBeVisible();
    const fingerprint = page.getByText(grouped, { exact: true });
    await expect(fingerprint, 'Otisak nakon predaje').toBeVisible();
    await page.reload();
    await expect(fingerprint, 'Isti otisak nakon osvježavanja').toBeVisible();
  });

  await test.step('Ponovno otvaranje rada dopušta samo čitanje', async () => {
    await page.goto(workPath);
    await expect(page).toHaveURL(workPath);
    await expect(statusBar.getByText('Samo za čitanje', { exact: true })).toBeVisible();
    await expect(editor.and(page.locator('[contenteditable="true"], [contenteditable="plaintext-only"]'))).toHaveCount(0);

    const stored = await page.request.get(`/api/v1/student/assignments/${assignmentId}/submission`);
    await expect(stored).toBeOK();
    expect(await stored.json()).toEqual({ state: 'potvrdeno', receipt });
  });

  await test.step('INT-14: nakon predaje poslužitelj i dalje ima samo V1', async () => {
    await page.unroute(`${webOrigin}/api/v1/evidence/commit`);
    for (const route of heldCommits.splice(0)) await route.abort().catch(() => undefined);
    const opened = await page.request.post('/api/v1/evidence/open', {
      headers: { origin: webOrigin, 'content-type': 'application/json', 'ductus-protocol': '1' },
      data: { assignmentId },
    });
    await expect(opened).toBeOK();
    const body = await opened.json();
    expect(body).toMatchObject({ submitted: true, currentRevision: revision, documentHash: savedWork.documentHash });
    expect(Buffer.from(body.document, 'base64').toString('utf8')).not.toContain(UNCONFIRMED_V2);
  });
});
