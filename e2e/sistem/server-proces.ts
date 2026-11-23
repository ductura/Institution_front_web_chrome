import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { checkHealth, serverHealthUrl, serverRoot } from './stog';

// VS-1.13 (DAN-887, A06): Institution_server really stops and starts again.
// The process that listens on its port is found through the kernel (`ss`),
// its command line, working directory and environment are read from /proc,
// it is stopped with SIGTERM and the same command is started again in the
// same directory with the same environment. Nothing in the server's checkout
// is read or changed, and no database connection is used: what the test reads
// afterwards comes through the API as the student (PLAN-MIGRACIJE §4a-1).
//
// On Windows there is no /proc: the server stays a child of `pnpm lokalno`,
// whose supervisor (Institution_server scripts/lokalno/nadzor.ts) records the
// server's PID and command line in .local/nadzor.json. The test announces the
// stop in .local/nadzor-server.stani, kills the process (on Windows always a
// hard kill, TerminateProcess), checks that it is gone, and asks for the start
// in .local/nadzor-server.pokreni; the supervisor starts the same command with
// the same environment it kept in memory. The checks before and after are the
// same as on Linux.

const SERVER_PORT = 4000;
const WINDOWS = process.platform === 'win32';

export type ServerProcess = { pid: number; argv: string[]; cwd: string; env: NodeJS.ProcessEnv };

/** The PID listening on the server's port, or null when nothing listens. */
export function listeningPid(port = SERVER_PORT): number | null {
  const pids = new Set(WINDOWS ? windowsListeners(port) : linuxListeners(port));
  if (pids.size > 1) throw new Error(`VS-1.13: na portu ${port} sluša više procesa (${[...pids].join(', ')}).`);
  const [pid] = pids;
  return pid ?? null;
}

function linuxListeners(port: number): number[] {
  const out = execFileSync('ss', ['-H', '-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

/** PIDs listening on `port`, from Get-NetTCPConnection (not netstat's localized text). */
function windowsListeners(port: number): number[] {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess }`],
  { encoding: 'utf8', windowsHide: true });
  return out.split(/\s+/u).filter((part) => /^\d+$/u.test(part)).map(Number);
}

type Supervisor = { supervisor: number; server: { pid: number; argv: string[]; cwd: string } };

const localFile = (name: string) => join(serverRoot(), '.local', name);

function readSupervisor(): Supervisor {
  const file = localFile('nadzor.json');
  const help = 'Pokreni stog s Institution_serverom koji ima scripts/lokalno/nadzor.ts (pnpm lokalno ili pnpm sve).';
  if (!existsSync(file)) throw new Error(`VS-1.13: nema ${file}. ${help}`);
  const state = JSON.parse(readFileSync(file, 'utf8')) as Partial<Supervisor> & { protocol?: number };
  if (state.protocol !== 1 || typeof state.supervisor !== 'number' || typeof state.server?.pid !== 'number')
    throw new Error(`VS-1.13: ${file} nije u očekivanom obliku. ${help}`);
  return state as Supervisor;
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
  /** How the process was stopped: SIGTERM on Linux, a hard kill on Windows. */
  stop: 'SIGTERM' | 'TerminateProcess';
  before: { pid: number; argv: string[]; cwd: string };
  after: { pid: number };
  stoppedAt: string;
  healthyAt: string;
};

/**
 * Stops the server process and starts the same command again. Its output goes
 * to `logPath` (Linux; on Windows it stays in the supervisor's output). Fails
 * unless the old process is gone, the port is closed and the health check
 * fails before the start, and the new process listens under a new PID and the
 * health check (with the database) answers `ok` again.
 */
export async function restartServer(logPath: string): Promise<Restart> {
  return WINDOWS ? restartUnderSupervisor() : restartDetached(logPath);
}

async function restartUnderSupervisor(): Promise<Restart> {
  const pid = listeningPid();
  if (pid === null) throw new Error(`VS-1.13: na portu ${SERVER_PORT} ne sluša Institution_server.`);
  const state = readSupervisor();
  // Never kill without a supervisor that will start the server again: the
  // stack would lose the simulator and the local S3 with it.
  if (!alive(state.supervisor)) throw new Error(`VS-1.13: nadzornik ${state.supervisor} iz nadzor.json ne radi.`);
  if (state.server.pid !== pid) throw new Error(`VS-1.13: na portu sluša PID ${pid}, a nadzor.json navodi ${state.server.pid}.`);
  const stopFile = localFile('nadzor-server.stani');
  writeFileSync(stopFile, '');
  try {
    process.kill(pid);
    await waitFor(`gašenje procesa ${pid}`, 20_000, () => !alive(pid) && listeningPid() === null);
    const stoppedAt = new Date().toISOString();
    if (await healthy()) throw new Error('VS-1.13: poslužitelj odgovara i nakon gašenja procesa.');
    writeFileSync(localFile('nadzor-server.pokreni'), '');
    await waitFor('ponovno podizanje poslužitelja', 90_000, healthy);
    const after = listeningPid();
    if (after === null || after === pid) throw new Error(`VS-1.13: nakon ponovnog pokretanja sluša PID ${after}, prije ${pid}.`);
    return {
      stop: 'TerminateProcess',
      before: { pid, argv: state.server.argv, cwd: state.server.cwd },
      after: { pid: after },
      stoppedAt,
      healthyAt: new Date().toISOString(),
    };
  } finally {
    rmSync(stopFile, { force: true });
  }
}

async function restartDetached(logPath: string): Promise<Restart> {
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
    stop: 'SIGTERM',
    before: { pid, argv: proc.argv, cwd: proc.cwd },
    after: { pid: after },
    stoppedAt,
    healthyAt: new Date().toISOString(),
  };
}
