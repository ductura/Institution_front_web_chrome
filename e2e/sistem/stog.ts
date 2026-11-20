import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../..', import.meta.url));
const startHelp = 'U repou Institution_server pokreni pnpm stog:gore (INT-01) i provjeri pnpm stog:zdravlje.';
const port = Number(process.env.STOG_FRONT_PORT ?? '3000');
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4000 || port === 8090) {
  throw new Error('STOG_FRONT_PORT mora biti port od 1024 do 65535, različit od portova 4000 i 8090.');
}

export const webOrigin = `http://localhost:${port}`;
export const oidcOrigin = 'http://localhost:8090';

async function checkService(url: string, service: string, checkBody?: (response: Response) => Promise<void>) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    if (checkBody) await checkBody(response);
    else await response.body?.cancel();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`INT-02: lokalni stog nije spreman. ${service} (${url}): ${detail}. ${startHelp}`);
  }
}

async function checkHealth(response: Response) {
  const health = await response.json();
  if (health.status !== 'ok' || typeof health.serverVersion !== 'string') {
    throw new Error('neočekivan odgovor Institution_servera');
  }
  if (health.state !== 'ok') throw new Error('PostgreSQL nije spreman');
}

function revision(directory: string, repo: string) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(`INT-02: ne mogu očitati Git HEAD za ${repo} u ${directory}. ` +
      'STOG_SERVER_DIR treba pokazivati na checkout iz kojeg je pokrenut pnpm stog:gore.');
  }
}

export default async function setup() {
  await checkService(`${webOrigin}/`, 'Next.js');
  await checkService('http://localhost:4000/api/v1/health', 'Institution_server', checkHealth);
  await checkService(`${webOrigin}/api/v1/health`, 'Next.js → Institution_server', checkHealth);
  await checkService(`${oidcOrigin}/.well-known/openid-configuration`, 'Simulator AAI@EduHr', async (response) => {
    const discovery = await response.json();
    if (discovery.issuer !== oidcOrigin) throw new Error('neočekivan OIDC izdavatelj');
  });

  const serverRoot = resolve(webRoot, process.env.STOG_SERVER_DIR?.trim() || '../Institution_server');
  console.log(`INT-02 WEB SHA ${revision(webRoot, 'Institution_front_web_chrome')}`);
  console.log(`INT-02 SRV SHA ${revision(serverRoot, 'Institution_server')}`);
}
