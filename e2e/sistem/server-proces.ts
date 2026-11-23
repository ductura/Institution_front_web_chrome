import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname } from 'node:path';

import { checkHealth, serverHealthUrl } from './stog';

// VS-1.13 (DAN-887, A06): Institution_server really stops and starts again.
// The process that listens on its port is found through the kernel (`ss`),
// its command line, working directory and environment are read from /proc,
// it is stopped with SIGTERM and the same command is started again in the
// same directory with the same environment. Nothing in the server's checkout
// is read or changed, and no database connection is used: what the test reads
// afterwards comes through the API as the student (PLAN-MIGRACIJE §4a-1).

const SERVER_PORT = 4000;

export type ServerProcess = { pid: number; argv: string[]; cwd: string; env: NodeJS.ProcessEnv };

/** The PID listening on the server's port, or null when nothing listens. */
export function listeningPid(port = SERVER_PORT): number | null {
  const out = execFileSync('ss', ['-H', '-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  const pids = new Set([...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])));
  if (pids.size > 1) throw new Error(`VS-1.13: na portu ${port} sluša više procesa (${[...pids].join(', ')}).`);
  const [pid] = pids;
  return pid ?? null;
}

function readProcess(pid: number): ServerProcess {
  const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter((part) => part !== '');
  const env: NodeJS.ProcessEnv = {};
  for (const entry of readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0')) {
    const at = entry.indexOf('=');
    if (at > 0) env[entry.slice(0, at)] = entry.slice(at + 1);
  }
  if (argv.length === 0) throw new Error(`VS-1.13: proces ${pid} nema naredbeni redak.`);
  return { pid, argv, cwd: readlinkSync(`/proc/${pid}/cwd`), env };
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function waitFor(what: string, timeoutMs: number, check: () => Promise<boolean> | boolean) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`VS-1.13: ${what} nije se dogodilo u ${timeoutMs / 1000} s.`);
}

async function healthy() {
  try {
    const response = await fetch(serverHealthUrl, { signal: AbortSignal.timeout(2_000) });
    if (response.status !== 200) return false;
    await checkHealth(response);
    return true;
  } catch {
    return false;
  }
}

export type Restart = {
  before: { pid: number; argv: string[]; cwd: string };
  after: { pid: number };
  stoppedAt: string;
  healthyAt: string;
};

/**
 * Stops the server process and starts the same command again. Its output goes
 * to `logPath`. Fails unless the new process listens under a new PID and the
 * health check (with the database) answers `ok` again.
 */
export async function restartServer(logPath: string): Promise<Restart> {
  const pid = listeningPid();
  if (pid === null) throw new Error(`VS-1.13: na portu ${SERVER_PORT} ne sluša Institution_server.`);
  const proc = readProcess(pid);

  process.kill(pid, 'SIGTERM');
  try {
    await waitFor(`gašenje procesa ${pid}`, 20_000, () => !alive(pid) && listeningPid() === null);
  } catch {
    if (alive(pid)) process.kill(pid, 'SIGKILL');
    await waitFor(`gašenje procesa ${pid} (SIGKILL)`, 5_000, () => !alive(pid) && listeningPid() === null);
  }
  const stoppedAt = new Date().toISOString();
  if (await healthy()) throw new Error('VS-1.13: poslužitelj odgovara i nakon gašenja procesa.');

  mkdirSync(dirname(logPath), { recursive: true });
  const log = openSync(logPath, 'a');
  const [command, ...args] = proc.argv;
  const child = spawn(command!, args, { cwd: proc.cwd, env: proc.env, detached: true, stdio: ['ignore', log, log] });
  child.unref();

  await waitFor('ponovno podizanje poslužitelja', 90_000, healthy);
  const after = listeningPid();
  if (after === null || after === pid) throw new Error(`VS-1.13: nakon ponovnog pokretanja sluša PID ${after}, prije ${pid}.`);
  return {
    before: { pid, argv: proc.argv, cwd: proc.cwd },
    after: { pid: after },
    stoppedAt,
    healthyAt: new Date().toISOString(),
  };
}
