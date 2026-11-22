// Pure part of vs-run.mjs (INT-10, DAN-887), tested by vs-run-model.test.mjs.

export const SCENARIOS = {
  'vs1-prijava-spremi-osvjezi': 'INT-02 (VS-1, A05/A06)',
  'zavrsna-predaja-studenta': 'INT-03 (A08 predaja)',
  'zavrsni-pregled-nastavnika': 'INT-04 (A09 RLS)',
  'tok-administrator-ustanove': 'INT-05 (A02–A04 administrator)',
};

/** The claims of docs/plan/VS-1.md, in order. */
export const CLAIMS = Array.from({ length: 13 }, (_, i) => `VS-1.${i + 1}`);

const FULL_SHA = /^[0-9a-f]{40}$/;
const VALUE_KEYS = ['documentId', 'revision', 'text', 'hash'];

/** Per scenario file: tests, failed, skipped and the first line of each error. */
export function scenarioResults(report) {
  const results = new Map();
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const file = String(spec.file ?? suite.file ?? '').split('/').pop().replace(/\.sistem\.ts$/u, '');
      const row = results.get(file) ?? { tests: 0, failed: 0, skipped: 0, errors: [] };
      for (const test of spec.tests ?? []) {
        row.tests += 1;
        if (test.status === 'skipped') row.skipped += 1;
        else if (test.status !== 'expected') {
          row.failed += 1;
          const last = test.results?.at(-1);
          row.errors.push(`${spec.title}: ${String(last?.error?.message ?? test.status).split('\n')[0]}`);
        }
      }
      results.set(file, row);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return results;
}

const sameValues = (a, b) => a != null && b != null && VALUE_KEYS.every((key) => a[key] === b[key]);

/**
 * vs-run.json. `ok` only when every scenario passed, the three SHAs are full,
 * the PID changed, the four values agree before and after, and every claim
 * VS-1.1 to VS-1.13 has its outcome.
 */
export function buildVsRun({ report, values, env, now }) {
  const results = scenarioResults(report);
  const scenarios = Object.entries(SCENARIOS).map(([file, label]) => {
    const row = results.get(file);
    const status = !row ? 'NIJE POKRENUT' : row.failed > 0 ? 'PAD' : row.skipped > 0 ? 'PRESKOČEN' : 'PROLAZ';
    return { file, label, status, tests: row?.tests ?? 0, errors: row?.errors ?? [] };
  });
  const sha = {
    web: env.SHA_WEB || values?.shas?.web || '',
    server: env.SHA_SERVER || values?.shas?.server || '',
    preloader: env.SHA_PRELOADER || values?.shas?.preloader || '',
  };
  const vs1Passed = scenarios[0].status === 'PROLAZ';
  const restart = values?.restart ?? null;
  const pidChanged = Number.isInteger(restart?.pidBefore) && Number.isInteger(restart?.pidAfter)
    && restart.pidBefore !== restart.pidAfter;
  const valuesMatch = sameValues(values?.before, values?.after);
  const shasFull = Object.values(sha).every((value) => FULL_SHA.test(value));
  const claims = CLAIMS.map((id) => {
    const evidence = values?.claims?.[id] ?? null;
    return { id, status: vs1Passed && evidence ? 'PROLAZ' : vs1Passed ? 'NEMA DOKAZA' : 'PAD', evidence };
  });
  const ok = scenarios.every((s) => s.status === 'PROLAZ') && shasFull && pidChanged && valuesMatch
    && claims.every((c) => c.status === 'PROLAZ');
  return {
    generatedAt: now.toISOString(),
    runUrl: env.RUN_URL ?? '',
    ok,
    sha,
    host: values?.host ?? 'packages/app',
    entry: values?.entry ?? null,
    serverPid: restart ? { before: restart.pidBefore, after: restart.pidAfter, changed: pidChanged } : null,
    restart,
    freshContext: values?.freshContext ?? null,
    values: { before: values?.before ?? null, after: values?.after ?? null, match: valuesMatch },
    claims,
    scenarios,
    stats: report?.stats ?? null,
  };
}

export function table(run) {
  const short = (text) => (typeof text === 'string' && text.length > 48 ? `${text.slice(0, 45)}…` : text);
  const value = (key) => `| ${key} | \`${short(String(run.values.before?.[key] ?? '–'))}\` | \`${short(String(run.values.after?.[key] ?? '–'))}\` |`;
  return [
    '## Sistemski prolaz (INT-08, INT-10)',
    '',
    '| Scenarij | Datoteka | Ishod |',
    '| --- | --- | --- |',
    ...run.scenarios.map((s) => `| ${s.label} | \`${s.file}\` | **${s.status}** |`),
    '',
    '| Tvrdnja | Ishod | Dokaz |',
    '| --- | --- | --- |',
    ...run.claims.map((c) => `| ${c.id} | **${c.status}** | ${c.evidence ?? '–'} |`),
    '',
    '| Vrijednost | Prije | Poslije |',
    '| --- | --- | --- |',
    ...['documentId', 'revision', 'text', 'hash'].map(value),
    '',
    `Host: \`${run.host}\` · ulaz: ${run.entry ?? '–'}`,
    `PID servera: ${run.serverPid ? `${run.serverPid.before} → ${run.serverPid.after}` : '–'}`,
    `WEB SHA: \`${run.sha.web}\``,
    `SRV SHA: \`${run.sha.server}\``,
    `PRELOADER SHA: \`${run.sha.preloader}\``,
    `Ishod: **${run.ok ? 'PROLAZ' : 'PAD'}**`,
    '',
    ...run.scenarios.flatMap((s) => s.errors.map((e) => `- ${s.label}: ${e}`)),
  ];
}
