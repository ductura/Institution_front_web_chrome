// INT-08: turns the Playwright JSON report of `pnpm test:sistem` into a
// PROLAZ/PAD table per scenario and into vs-run.json (with the Git SHAs).
// Usage: node e2e/sistem/tablica.mjs <report.json> <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [reportPath, outDir] = process.argv.slice(2);
if (!reportPath || !outDir) throw new Error('usage: tablica.mjs <report.json> <out-dir>');

const SCENARIOS = {
  'vs1-prijava-spremi-osvjezi': 'INT-02 (VS-1, A05/A06)',
  'zavrsna-predaja-studenta': 'INT-03 (A08 predaja)',
  'zavrsni-pregled-nastavnika': 'INT-04 (A09 RLS)',
  'tok-administrator-ustanove': 'INT-05 (A02–A04 administrator)',
};

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
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
for (const suite of report.suites ?? []) walk(suite);

const shas = {
  web: process.env.SHA_WEB ?? '',
  server: process.env.SHA_SERVER ?? '',
};
const scenarios = Object.entries(SCENARIOS).map(([file, label]) => {
  const row = results.get(file);
  const status = !row ? 'NIJE POKRENUT' : row.failed > 0 ? 'PAD' : row.skipped > 0 ? 'PRESKOČEN' : 'PROLAZ';
  return { file, label, status, tests: row?.tests ?? 0, errors: row?.errors ?? [] };
});

const lines = [
  '## Završni prolaz Faze 3 (INT-08)',
  '',
  '| Scenarij | Datoteka | Ishod |',
  '| --- | --- | --- |',
  ...scenarios.map((s) => `| ${s.label} | \`${s.file}\` | **${s.status}** |`),
  '',
  `WEB SHA: \`${shas.web}\``,
  `SRV SHA: \`${shas.server}\``,
  '',
  ...scenarios.flatMap((s) => s.errors.map((e) => `- ${s.label}: ${e}`)),
];
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'tablica.md'), `${lines.join('\n')}\n`);
writeFileSync(join(outDir, 'vs-run.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  runUrl: process.env.RUN_URL ?? '',
  sha: shas,
  scenarios,
  stats: report.stats ?? null,
}, null, 2)}\n`);
console.log(lines.join('\n'));
if (scenarios.some((s) => s.status !== 'PROLAZ')) process.exitCode = 1;
