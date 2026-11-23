import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIResponse, type BrowserContext, type Page, type Request, type Response } from '@playwright/test';

import {
  verifySignedEvidenceReceiptV2,
  type EvidenceDomainKey,
} from '../../packages/editor-core/src/document/forensics/evidence-receipt-verifier';
import { restartServer, type Restart } from './server-proces';
import { app, repoRevisions, shippedHost, webOrigin } from './stog';
import { assignmentOf, describePageOnFailure, journalHolds, openDemoWork, signInDemoStudent } from './student';

// INT-02 (VS-1, A05/A06; INT-10, DAN-887). The student enters through the
// Preloader on `/`, writes in the shipped packages/app, and the claims of
// PLAN-MIGRACIJE §4a-1 are checked one by one (docs/plan/VS-1.md): the text is
// first on the device, "Spremljeno na poslužitelju" only after the server's
// receipt, the same key gives one revision, and after a real restart of the
// server a fresh browser context reads back the same document, revision, text
// and an independently computed hash, through the API as the student.

describePageOnFailure();

const SHA256_HEX = /^[0-9a-f]{64}$/;
const ON_DEVICE = 'Spremljeno na uređaju';
const ON_SERVER = 'Spremljeno na poslužitelju';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

type Values = { documentId: string; revision: number; text: string; hash: string };
type Seen = { at: number; text: string };

/** Every text the save chip shows, with the browser's clock, from the first paint on. */
async function recordSaveChip(context: BrowserContext) {
  await context.addInitScript(() => {
    const seen: { at: number; text: string }[] = [];
    (window as unknown as { __vs1Chip: typeof seen }).__vs1Chip = seen;
    const read = () => {
      const chip = document.querySelector('footer[aria-label="Stanje rada"] [role="status"]');
      const text = chip?.textContent?.trim() ?? '';
      if (text !== '' && seen.at(-1)?.text !== text) seen.push({ at: Date.now(), text });
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
}

const chipHistory = (page: Page) => page.evaluate(() => (window as unknown as { __vs1Chip: Seen[] }).__vs1Chip);

const journalCount = (page: Page) => page.evaluate(async () =>
  (await indexedDB.databases()).filter(({ name }) => name?.startsWith('ductus-journal-v1-')).length);

/** The text of a canonical document: every `text` value, in document order. */
function documentText(bytes: Buffer): string {
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        if (key === 'text' && typeof entry === 'string') parts.push(entry);
        else walk(entry);
      }
    }
  };
  walk(JSON.parse(bytes.toString('utf8')));
  return parts.join('\n');
}

const isOpen = (response: Response, assignmentId: string) => response.url() === `${webOrigin}/api/v1/evidence/open`
  && response.request().method() === 'POST' && response.request().postDataJSON()?.assignmentId === assignmentId;

function carries(request: Request, sentence: string) {
  if (request.url() !== `${webOrigin}/api/v1/evidence/commit` || request.method() !== 'POST') return false;
  const document = request.postDataJSON()?.document;
  return typeof document === 'string' && Buffer.from(document, 'base64').toString('utf8').includes(sentence);
}

/** What the open route returned for the work, read as the test reads it, never as the client does. */
async function openedValues(open: Response | APIResponse, sentence: string): Promise<Values & { body: Record<string, unknown> }> {
  expect(open.status(), 'evidence/open kao student').toBe(200);
  const body = await open.json();
  expect(body).toMatchObject({ status: 'opened', documentId: expect.any(String), documentHash: expect.stringMatching(SHA256_HEX) });
  const bytes = Buffer.from(body.document, 'base64');
  const text = documentText(bytes);
  expect(text, 'tekst dokumenta s poslužitelja').toContain(sentence);
  // The hash is computed here from the bytes the server sent, not taken from its answer.
  const hash = sha256(bytes);
  expect(body.documentHash, 'documentHash poslužitelja = SHA-256 primljenih bajtova').toBe(hash);
  return { documentId: body.documentId, revision: body.currentRevision, text, hash, body };
}

/** Headers of a browser request that a replay may send again (no cookie or framing). */
function replayHeaders(headers: Record<string, string>) {
  const skip = new Set(['cookie', 'host', 'content-length', 'connection']);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !skip.has(name) && !name.startsWith(':')));
}

test('VS-1: kroz Preloader student piše u isporučenom packages/app, spremanje je potvrđeno, a rad preživi ponovno pokretanje servera', async ({ browser, context, page }, testInfo) => {
  test.setTimeout(240_000);
  const sentence = `U izmišljenom vrtu nastaje kompost (VS-1 ${randomUUID()}).`;
  const shas = repoRevisions();
  await recordSaveChip(context);
  const editor = page.getByRole('textbox', { name: 'Tekst rada', exact: true });
  const chip = page.locator('footer[aria-label="Stanje rada"]').getByRole('status');
  const claims: Record<string, string> = {};

  const { workPath, opened } = await test.step('VS-1.1–VS-1.4: ulaz kroz Preloader, prijava preko AAI@EduHr i otvaranje vlastitog rada', async () => {
    await signInDemoStudent(page);
    claims['VS-1.1'] = 'ulaz na / (Preloader) i povratak u /app/web/';
    claims['VS-1.2'] = 'prijava kroz lažni AAI@EduHr (D-09), sesija /api/v1/me = student';
    const [opened, workPath] = await Promise.all([
      page.waitForResponse((response) => /\/api\/v1\/evidence\/open$/.test(response.url()), { timeout: 30_000 }),
      openDemoWork(page),
    ]);
    expect(isOpen(opened, assignmentOf(workPath)), 'editor otvara rad zadatka s početne stranice').toBe(true);
    await expect(editor).toBeEditable();
    claims['VS-1.3'] = `isporučeni host ${shippedHost} poslužuje ${workPath}`;
    claims['VS-1.4'] = 'vlastiti rad iz seeda otvoren u editoru (uređiv)';
    return { workPath, opened: await opened.json() as { documentId: string; receiptKeys: EvidenceDomainKey[] } };
  });
  const assignmentId = assignmentOf(workPath);

  // Commits that carry the sentence wait here until the test lets them go.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${webOrigin}/api/v1/evidence/commit`, async (route) => {
    if (carries(route.request(), sentence)) await gate;
    await route.continue();
  });

  const held = await test.step('VS-1.5–VS-1.6 (A05): rečenica je prvo zapisana na uređaju', async () => {
    await editor.click();
    await page.keyboard.press('Control+End');
    const [request] = await Promise.all([
      page.waitForRequest((request) => carries(request, sentence), { timeout: 30_000 }),
      page.keyboard.insertText(` ${sentence}`),
    ]);
    await expect(editor).toContainText(sentence);
    await expect.poll(() => journalHolds(page, sentence), { message: 'rečenica u lokalnom dnevniku (IndexedDB)' }).toBe(true);
    // The request is held: the server has not seen the sentence, so the chip may not claim it.
    await page.waitForTimeout(1_000);
    await expect(chip).not.toHaveText(ON_SERVER);
    const history = await chipHistory(page);
    expect(history.map(({ text }) => text), 'prije potvrde oznaka kaže „na uređaju”').toContain(ON_DEVICE);
    expect(history.map(({ text }) => text)).not.toContain(ON_SERVER);
    claims['VS-1.5'] = 'jedinstvena izmišljena rečenica upisana u editor';
    claims['VS-1.6'] = `„${ON_DEVICE}” i zapis u IndexedDB prije odgovora poslužitelja`;
    return request;
  });

  const before = await test.step('VS-1.7 (A05): „Spremljeno na poslužitelju” tek nakon provjerene potvrde za istu transakciju, dokument i reviziju', async () => {
    const releasedAt = Date.now();
    // The first send may ask for protocol 2; a server without it answers 426 and
    // the client sends the same commit again under 1 (src/client/evidence-ingest.ts).
    const [commit] = await Promise.all([
      page.waitForResponse((response) => carries(response.request(), sentence) && response.status() !== 426, { timeout: 30_000 }),
      (async () => release())(),
    ]);
    const confirmed = commit.request();
    expect(confirmed.postDataJSON().clientTransactionId, 'isti ključ kao zadržani zahtjev').toBe(held.postDataJSON().clientTransactionId);
    const body = commit.status() === 200 ? await commit.json() : await commit.json().catch(() => null);
    expect(commit.status(), `spremanje: ${JSON.stringify(body)}`).toBe(200);
    const sent = confirmed.postDataJSON() as { documentId: string; clientTransactionId: string; segments: string[]; document: string };
    expect(body).toMatchObject({
      status: expect.stringMatching(/^(committed|duplicate)$/),
      revision: expect.any(Number),
      receipt: { status: 'signed' },
    });
    const keys = opened.receiptKeys;
    const verified = await verifySignedEvidenceReceiptV2(body.receipt.signedReceipt, {
      documentId: sent.documentId,
      clientTransactionId: sent.clientTransactionId,
      revision: body.revision,
      evidenceDomainId: keys[0]!.evidenceDomainId,
    }, keys);
    expect(verified, 'Ed25519 potvrda pod ključem iz evidence/open').toMatchObject({ ok: true });
    const sentSegments = sent.segments.map((segment) => sha256(Buffer.from(segment, 'base64')));
    expect(sentSegments, 'potvrda je za poslani segment').toContain(body.receipt.signedReceipt.payload.segmentHash);

    await expect(chip).toHaveText(ON_SERVER, { timeout: 30_000 });
    const history = await chipHistory(page);
    const firstServer = history.find(({ text }) => text === ON_SERVER);
    const lastDevice = history.findLast(({ text, at }) => text === ON_DEVICE && at <= (firstServer?.at ?? Infinity));
    expect(lastDevice, '„na uređaju” prije „na poslužitelju”').toBeTruthy();
    expect(firstServer!.at, '„na poslužitelju” tek nakon što je poslužitelj dobio zahtjev').toBeGreaterThanOrEqual(releasedAt);
    claims['VS-1.7'] = `HTTP 200, potvrda ${body.status}, revizija ${body.revision}, potpis Ed25519 provjeren; „${ON_SERVER}” nakon odgovora`;
    return {
      documentId: sent.documentId,
      revision: body.revision as number,
      text: documentText(Buffer.from(sent.document, 'base64')),
      hash: sha256(Buffer.from(sent.document, 'base64')),
      request: { headers: replayHeaders(await confirmed.allHeaders()), body: confirmed.postData() ?? '' },
    };
  });
  expect(before.documentId).toBe(opened.documentId);
  expect(before.text).toContain(sentence);

  await test.step('VS-1.10: isti ključ i isti bajtovi daju jednu reviziju', async () => {
    const replay = await page.request.post('/api/v1/evidence/commit', { headers: before.request.headers, data: before.request.body });
    const body = await replay.json().catch(() => null);
    expect(replay.status(), `ponovljeni zahtjev: ${JSON.stringify(body)}`).toBe(200);
    expect(body).toMatchObject({ status: 'duplicate', revision: before.revision });
    const open = await page.request.post('/api/v1/evidence/open', {
      headers: { origin: webOrigin, 'content-type': 'application/json', 'ductus-protocol': '1' },
      data: { assignmentId },
    });
    const now = await openedValues(open, sentence);
    expect(now.revision, 'nakon ponavljanja i dalje ista revizija').toBe(before.revision);
    expect(now.hash).toBe(before.hash);
    claims['VS-1.10'] = `ponovljeni zahtjev (isti clientTransactionId, isti bajtovi): HTTP 200 duplicate, revizija ostaje ${before.revision}`;
  });

  await test.step('VS-1.8: nakon osvježavanja rečenica je i dalje u radu', async () => {
    await page.reload();
    await expect(editor).toContainText(sentence);
    claims['VS-1.8'] = 'osvježavanje stranice: rečenica u editoru';
  });

  const fresh = async (label: string) => {
    const freshContext = await browser.newContext({ baseURL: webOrigin });
    const freshPage = await freshContext.newPage();
    await signInDemoStudent(freshPage);
    expect(await journalCount(freshPage), `${label}: svjež kontekst nema lokalni dnevnik`).toBe(0);
    const [open] = await Promise.all([
      freshPage.waitForResponse((response) => isOpen(response, assignmentId), { timeout: 30_000 }),
      openDemoWork(freshPage),
    ]);
    const values = await openedValues(open, sentence);
    await expect(freshPage.getByRole('textbox', { name: 'Tekst rada', exact: true })).toContainText(sentence);
    return { context: freshContext, values };
  };

  await test.step('VS-1.9 (A05): čisti kontekst bez lokalnog dnevnika dobiva isti dokument s poslužitelja', async () => {
    const { context: clean, values } = await fresh('VS-1.9');
    try {
      expect(pick(values)).toEqual(pick(before));
      claims['VS-1.9'] = 'novi kontekst preglednika: isti documentId, revizija, tekst i hash';
    } finally {
      await clean.close();
    }
  });

  await test.step('VS-1.11: drugi student ne može pročitati ni izmijeniti taj rad', async () => {
    const otherContext = await browser.newContext({ baseURL: webOrigin });
    try {
      const other = await otherContext.newPage();
      await signInDemoStudent(other, 'demo-student-2');
      const open = await other.request.post('/api/v1/evidence/open', {
        headers: { origin: webOrigin, 'content-type': 'application/json', 'ductus-protocol': '1' },
        data: { assignmentId },
      });
      if (open.status() === 200) expect((await open.json()).documentId, 'drugi student ne dobiva tuđi dokument').not.toBe(before.documentId);
      else expect(open.status()).toBeGreaterThanOrEqual(400);
      const write = await other.request.post('/api/v1/evidence/commit', { headers: before.request.headers, data: before.request.body });
      expect(write.status(), 'tuđi commit je odbijen').toBeGreaterThanOrEqual(400);
      claims['VS-1.11'] = `demo-student-2: evidence/open HTTP ${open.status()}, commit HTTP ${write.status()}`;
    } finally {
      await otherContext.close();
    }
  });

  const restart: Restart = await test.step('VS-1.13 (A06): Institution_server se stvarno gasi i ponovno podiže (novi PID)', async () =>
    restartServer(testInfo.outputPath('institution-server-nakon-ponovnog-pokretanja.log')));

  const after = await test.step('VS-1.13 (A06): svjež kontekst nakon ponovnog pokretanja vraća isti documentId, reviziju, tekst i neovisni hash', async () => {
    const { context: clean, values } = await fresh('VS-1.13');
    try {
      expect(pick(values)).toEqual(pick(before));
      claims['VS-1.13'] = `PID ${restart.before.pid} → ${restart.after.pid} (${restart.stop}); novi kontekst: iste četiri vrijednosti kroz API kao student`;
      return pick(values);
    } finally {
      await clean.close();
    }
  });

  claims['VS-1.12'] = `SHA weba ${shas.web}, servera ${shas.server}, Preloadera ${shas.preloader}; host ${shippedHost}`;
  const record = {
    shas,
    host: shippedHost,
    entry: `${webOrigin}/ → ${webOrigin}${app('/')}`,
    restart: { pidBefore: restart.before.pid, pidAfter: restart.after.pid, stop: restart.stop, command: restart.before.argv, stoppedAt: restart.stoppedAt, healthyAt: restart.healthyAt },
    freshContext: { kind: 'browser.newContext()', journalsAtStart: 0 },
    before: pick(before),
    after,
    claims,
  };
  const out = join(testInfo.project.outputDir, 'vs-1-vrijednosti.json');
  mkdirSync(testInfo.project.outputDir, { recursive: true });
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  await testInfo.attach('vs-1-vrijednosti', { path: out, contentType: 'application/json' });
});

function pick(values: Values): Values {
  return { documentId: values.documentId, revision: values.revision, text: values.text, hash: values.hash };
}
