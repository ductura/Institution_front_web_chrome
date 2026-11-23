// INT-08, INT-10 (DAN-887): turns the Playwright JSON report of
// `pnpm test:sistem` and the values that INT-02 wrote into vs-run.json and a
// PROLAZ/PAD table per scenario. vs-run.json carries the three full SHAs (web,
// server, Preloader), the shipped host, the server PIDs before and after the
// restart, the fresh browser context, the four values before and after, and
// the outcome of VS-1.1 to VS-1.13.
// Usage: node e2e/vs-run/vs-run.mjs <report.json> <vs-1-vrijednosti.json> <out-dir>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildVsRun, table } from './vs-run-model.mjs';

const [reportPath, valuesPath, outDir] = process.argv.slice(2);
if (!reportPath || !valuesPath || !outDir) throw new Error('usage: vs-run.mjs <report.json> <vs-1-vrijednosti.json> <out-dir>');

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);
const run = buildVsRun({
  report: readJson(reportPath),
  values: readJson(valuesPath),
  env: process.env,
  now: new Date(),
});
const lines = table(run);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'tablica.md'), `${lines.join('\n')}\n`);
writeFileSync(join(outDir, 'vs-run.json'), `${JSON.stringify(run, null, 2)}\n`);
console.log(lines.join('\n'));
if (!run.ok) process.exitCode = 1;
