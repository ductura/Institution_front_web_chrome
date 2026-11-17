// Line endings (DAN-952): every text file is stored with LF in the index and
// the listed image, font and archive types are binary. Run with
// npm run test:helpers (CI job test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const attributes = join(root, '.gitattributes');
const BINARY = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'woff', 'woff2', 'ttf', 'otf', 'zip', 'tgz', 'gz', 'pdf'];

// Git with no system, global or user configuration, so the result does not
// depend on core.autocrlf or other settings of the machine.
function git(cwd, args, input) {
  const home = mkdtempSync(join(tmpdir(), 'ga-home-'));
  try {
    const r = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', ...args], {
      cwd,
      input,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: home, XDG_CONFIG_HOME: home },
    });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

// Paths whose index line ending is CRLF or mixed, from `git ls-files --eol -z`.
// A record is `i/<eol> w/<eol> attr/<attrs>\t<path>`; the attr field may hold
// spaces, so it is split on the first tab only.
export function crlfPaths(output) {
  const found = [];
  for (const record of String(output).split('\0')) {
    if (record === '') continue;
    const tab = record.indexOf('\t');
    assert.ok(tab > 0, `record has a tab: ${JSON.stringify(record)}`);
    const index = record.slice(0, tab).split(/\s/)[0];
    if (index === 'i/crlf' || index === 'i/mixed') found.push(record.slice(tab + 1));
  }
  return found;
}

test('crlfPaths finds CRLF and mixed entries, whatever the path holds', () => {
  const rec = (i, path) => `${i.padEnd(7)} w/lf    attr/text=auto eol=lf \t${path}\0`;
  const out = [
    rec('i/crlf', 'a.txt'),
    rec('i/mixed', 'dir with space/b.tsx'),
    rec('i/crlf', 'tab\there.md'),
    rec('i/crlf', 'win\\path\\c.css'),
    rec('i/crlf', 'nbsp čćž.json'),
    rec('i/lf', 'ok.ts'),
    rec('i/-text', 'logo.png'),
    rec('i/none', 'empty'),
    rec('i/', 'link'),
  ].join('');
  assert.deepEqual(crlfPaths(out), ['a.txt', 'dir with space/b.tsx', 'tab\there.md', 'win\\path\\c.css', 'nbsp čćž.json']);
  assert.deepEqual(crlfPaths(''), []);
  assert.throws(() => crlfPaths('i/crlf w/crlf attr/ a.txt\0'));
});

test('.gitattributes stores text with LF and keeps listed types byte for byte', () => {
  const run = (withAttributes) => {
    const dir = mkdtempSync(join(tmpdir(), 'ga-repo-'));
    try {
      git(dir, ['init', '-q']);
      if (withAttributes) copyFileSync(attributes, join(dir, '.gitattributes'));
      writeFileSync(join(dir, 'a.txt'), 'a\r\nb\r\n');
      writeFileSync(join(dir, 'noext'), 'a\r\nb\r\n');
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x0d, 0x0a]);
      for (const ext of BINARY) writeFileSync(join(dir, `x.${ext}`), bytes);
      git(dir, ['add', '.']);
      for (const ext of BINARY) assert.ok(git(dir, ['cat-file', '-p', `:x.${ext}`]).equals(bytes), `x.${ext} unchanged`);
      return crlfPaths(git(dir, ['ls-files', '--eol', '-z']));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  assert.deepEqual(run(false), ['a.txt', 'noext'], 'control: without the file CRLF stays');
  assert.deepEqual(run(true), []);
});

test('.gitattributes marks listed types binary and text as auto with LF', () => {
  assert.ok(existsSync(attributes), '.gitattributes exists');
  assert.ok(!readFileSync(attributes, 'utf8').includes('\r'), '.gitattributes itself has no CR');
  const paths = [...BINARY.flatMap((e) => [`x.${e}`, `sub/dir/y.${e}`]), 'a.ts', 'README.md'];
  const out = git(root, ['check-attr', 'text', 'eol', 'binary', 'diff', '--', ...paths]).toString();
  const attr = (p, a) => out.match(new RegExp(`^${p.replace(/[.]/g, '\\.')}: ${a}: (.*)$`, 'm'))?.[1];
  for (const p of paths.slice(0, -2)) {
    assert.deepEqual([attr(p, 'binary'), attr(p, 'text'), attr(p, 'diff')], ['set', 'unset', 'unset'], p);
  }
  for (const p of ['a.ts', 'README.md']) assert.deepEqual([attr(p, 'text'), attr(p, 'eol')], ['auto', 'lf'], p);
});

test('no tracked text file has CRLF in the index', () => {
  assert.deepEqual(crlfPaths(git(root, ['ls-files', '--eol', '-z'])), []);
});
