// INT-08: reads the Playwright JSON report of `pnpm test:sistem` and prints a
// PROLAZ/PAD table (Markdown, for $GITHUB_STEP_SUMMARY), then writes vs-run.json.
// Exit code 1 when any scenario failed or did not run, so the job shows the failure.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCENARIOS = [
  { id: 'INT-02', file: 'vs1-prijava-spremi-osvjezi.sistem.ts', name: 'VS-1: prijava, spremanje, osvježavanje' },
  { id: 'INT-03', file: 'zavrsna-predaja-studenta.sistem.ts', name: 'Završna predaja studenta' },
  { id: 'INT-04', file: 'zavrsni-pregled-nastavnika.sistem.ts', name: 'Završni pregled nastavnika' },
  { id: 'INT-05', file: 'tok-administrator-ustanove.sistem.ts', name: 'Tok administratora ustanove' },
];

function collectSpecs(suite, file, out) {
  const here = suite.file ?? file;
  for (const spec of suite.specs ?? []) out.push({ file: spec.file ?? here, title: spec.title, tests: spec.tests ?? [] });
  for (const child of suite.suites ?? []) collectSpecs(child, here, out);
  return out;
}

function specStatus(spec) {
  const results = spec.tests.flatMap((t) => t.results ?? []);
  if (results.length === 0) return 'nije pokrenut';
  const last = spec.tests.map((t) => t.results?.at(-1)?.status);
  if (last.every((s) => s === 'passed')) return 'passed';
  if (last.every((s) => s === 'skipped')) return 'skipped';
  return last.find((s) => s !== 'passed' && s !== 'skipped') ?? 'failed';
}

function firstError(spec) {
  for (const t of spec.tests) for (const r of t.results ?? []) {
    const msg = r.error?.message ?? r.errors?.[0]?.message;
    if (msg) return msg.replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim())?.trim().slice(0, 200);
  }
  return '';
}

export function summarize(report) {
  const specs = (report?.suites ?? []).flatMap((s) => collectSpecs(s, s.file, []));
  const globalErrors = (report?.errors ?? []).map((e) => (e.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]);
  return SCENARIOS.map((sc) => {
    const mine = specs.filter((s) => (s.file ?? '').endsWith(sc.file));
    if (mine.length === 0) {
      return { ...sc, verdict: 'PAD', tests: [], note: globalErrors[0]?.slice(0, 200) || 'nema rezultata u izvještaju' };
    }
    const tests = mine.map((s) => ({ title: s.title, status: specStatus(s), error: firstError(s) }));
    const ok = tests.every((t) => t.status === 'passed');
    return { ...sc, verdict: ok ? 'PROLAZ' : 'PAD', tests, note: tests.find((t) => t.error)?.error ?? '' };
  });
}

function sha(dir) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function cell(text) {
  return String(text).replace(/\|/g, '\|').replace(/\r?\n/g, ' ');
}

export function renderMarkdown(rows, meta) {
  const lines = [
    '## Završni prolaz faze 3 (INT-08)',
    '',
    `WEB \`${meta.web ?? '?'}\` · SRV \`${meta.srv ?? '?'}\`${meta.runUrl ? ` · [run](${meta.runUrl})` : ''}`,
    '',
    '| Scenarij | Opis | Ishod | Testova | Napomena |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const passed = r.tests.filter((t) => t.status === 'passed').length;
    lines.push(`| ${r.id} | ${cell(r.name)} | ${r.verdict === 'PROLAZ' ? '✅ PROLAZ' : '❌ PAD'} | ${passed}/${r.tests.length} | ${cell(r.note)} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const webRoot = fileURLToPath(new URL('../..', import.meta.url));
  const reportPath = process.env.SISTEM_REPORT ?? resolve(webRoot, 'test-results/sistem-report.json');
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  const rows = summarize(report);
  const meta = {
    web: sha(webRoot),
    srv: sha(resolve(webRoot, process.env.STOG_SERVER_DIR?.trim() || '../Institution_server')),
    runUrl: process.env.SISTEM_RUN_URL ?? null,
  };
  process.stdout.write(renderMarkdown(rows, meta));
  if (!report) process.stdout.write(`\nIzvještaj ${reportPath} ne postoji: testovi nisu došli do kraja.\n`);
  const run = {
    task: 'INT-08',
    generatedAt: new Date().toISOString(),
    shas: { Institution_front_web_chrome: meta.web, Institution_server: meta.srv },
    runUrl: meta.runUrl,
    scenarios: rows,
    ok: rows.every((r) => r.verdict === 'PROLAZ'),
  };
  if (process.env.SISTEM_OUT) writeFileSync(process.env.SISTEM_OUT, JSON.stringify(run, null, 2) + '\n');
  process.exitCode = run.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
