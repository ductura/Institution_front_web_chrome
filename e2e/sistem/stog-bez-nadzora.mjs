// INT-10 (DAN-887, VS-1.13): `pnpm lokalno` of Institution_server supervises
// its children (simulator AAI@EduHr, local S3, server) and stops all of them
// when one exits. VS-1.13 stops and starts the server alone, so before the
// tests this script takes the stack over: it reads each child's command line,
// working directory and environment from /proc, stops the supervisor (which
// stops its children), makes sure PostgreSQL is up, and starts the same
// commands again as independent processes, each with its own log. Nothing in
// the server's checkout is read or changed. Linux only (CI and local stack).
// Usage: node e2e/sistem/stog-bez-nadzora.mjs <server-dir> <log-dir>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, readlinkSync } from 'node:fs';
import { basename, join } from 'node:path';

const [serverDir, logDir] = process.argv.slice(2);
if (!serverDir || !logDir) throw new Error('usage: stog-bez-nadzora.mjs <server-dir> <log-dir>');

const sh = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listening() {
  const ports = new Map();
  for (const line of sh('ss', ['-H', '-ltnp']).split('\n')) {
    // LISTEN 0 511 127.0.0.1:8090 0.0.0.0:* users:(("node",pid=1,fd=21))
    const local = line.trim().split(/\s+/u)[3] ?? '';
    const port = Number(local.slice(local.lastIndexOf(':') + 1));
    for (const [, pid] of line.matchAll(/pid=(\d+)/gu)) {
      const list = ports.get(Number(pid)) ?? [];
      if (Number.isInteger(port)) list.push(port);
      ports.set(Number(pid), list);
    }
  }
  return ports;
}

function readProcess(pid) {
  const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
  const env = {};
  for (const entry of readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0')) {
    const at = entry.indexOf('=');
    if (at > 0) env[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return { pid, argv, cwd: readlinkSync(`/proc/${pid}/cwd`), env };
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function until(what, timeoutMs, check) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(250);
  }
  throw new Error(`stog-bez-nadzora: ${what} nije se dogodilo u ${timeoutMs / 1000} s.`);
}

const supervisor = sh('pgrep', ['-f', 'scripts/lokalno/lokalno.ts']).trim().split('\n').map(Number).filter(Boolean);
if (supervisor.length !== 1) throw new Error(`stog-bez-nadzora: očekivan jedan lokalno.ts, nađeno ${supervisor.length}.`);
const [parent] = supervisor;
const ports = listening();
const children = sh('ps', ['-o', 'pid=', '--ppid', String(parent)]).split('\n').map(Number).filter(Boolean)
  .map((pid) => ({ ...readProcess(pid), ports: ports.get(pid) ?? [] }));
if (children.length === 0) throw new Error('stog-bez-nadzora: lokalno.ts nema podprocesa.');
const isServer = (child) => child.ports.includes(4000);
if (children.filter(isServer).length !== 1) throw new Error('stog-bez-nadzora: među podprocesima nije točno jedan server na :4000.');

process.kill(parent, 'SIGTERM');
await until('gašenje lokalno.ts i podprocesa', 30_000, () => !alive(parent) && children.every((child) => !alive(child.pid)));
await until('oslobađanje portova', 15_000, () => {
  const now = listening();
  return children.every((child) => child.ports.every((port) => ![...now.values()].flat().includes(port)));
});

// The supervisor may stop PostgreSQL on its way out; the volume keeps the data.
sh('docker', ['compose', 'up', '-d', '--wait', 'postgres-main'], { cwd: serverDir, stdio: 'inherit' });

mkdirSync(logDir, { recursive: true });
const order = [...children.filter((child) => !isServer(child)), ...children.filter(isServer)];
for (const child of order) {
  const name = basename(child.argv.at(-1) ?? 'proces').replace(/\.[jt]s$/u, '');
  const log = openSync(join(logDir, `${name}.log`), 'a');
  const [command, ...args] = child.argv;
  spawn(command, args, { cwd: child.cwd, env: child.env, detached: true, stdio: ['ignore', log, log] }).unref();
  await until(`pokretanje ${name} (${child.ports.join(', ')})`, 90_000, () => {
    const now = [...listening().values()].flat();
    return child.ports.every((port) => now.includes(port));
  });
  console.log(`${name}: ${child.argv.join(' ')} (port ${child.ports.join(', ') || '–'})`);
}

await until('zdravlje servera', 60_000, async () => {
  try {
    const health = await (await fetch('http://127.0.0.1:4000/api/v1/health')).json();
    return health.status === 'ok' && health.state === 'ok';
  } catch {
    return false;
  }
});
console.log('Stog radi bez nadzornika: server se smije zasebno ugasiti i ponovno pokrenuti (VS-1.13).');
