import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// INT-10 (DAN-887): the system tests run what is shipped. The browser has one
// origin, the Preloader's local edge (deploy/edge/dev-proxy.mjs of
// ductura/Preloader): `/` is the Preloader's build, `/api/v1/*` the real
// Institution_server and `/aplikacija/*` the production build of packages/app
// (`pnpm build` + `pnpm start` in this repo). The root Next app in src/app is
// not served.
const webRoot = fileURLToPath(new URL('../..', import.meta.url));
const startHelp = 'Pokreni stog kao .github/workflows/sistem.yml: Institution_server (pnpm lokalno --izvor=http://localhost:8000), '
  + 'ovaj front (pnpm build && pnpm start) i edge Preloadera (pnpm build && pnpm edge).';
const port = Number(process.env.STOG_EDGE_PORT ?? '8000');
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4000 || port === 8090 || port === 5173) {
  throw new Error('STOG_EDGE_PORT mora biti port od 1024 do 65535, različit od portova 4000, 5173 i 8090.');
}

/** The one origin the browser uses: the Preloader's edge. */
export const webOrigin = `http://localhost:${port}`;
export const oidcOrigin = 'http://localhost:8090';
/** Where packages/app answers behind the edge (README of packages/app). */
export const appBase = '/aplikacija';
/** The direct address of Institution_server, for the health check after a restart. */
export const serverHealthUrl = 'http://127.0.0.1:4000/api/v1/health';
/** The host the tests exercise: the shipped package, not src/app. */
export const shippedHost = 'packages/app';

/** A path of the shipped app, e.g. app('/zadaci') = '/aplikacija/zadaci'. */
export const app = (path: string) => `${appBase}${path === '/' ? '/' : path}`;

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
    throw new Error(`INT-10: lokalni stog nije spreman. ${service} (${url}): ${detail}. ${startHelp}`);
  }
}

export async function checkHealth(response: Response) {
  const health = await response.json();
  if (health.status !== 'ok' || typeof health.serverVersion !== 'string') {
    throw new Error('neočekivan odgovor Institution_servera');
  }
  if (health.state !== 'ok') throw new Error('PostgreSQL nije spreman');
}

async function checkPreloader(response: Response) {
  const html = await response.text();
  // D-318: the Preloader's first screen is /ulaz; it leads to the app's sign-in screen (/aplikacija/prijava),
  // which leaves for the AAI@EduHr login and returns to /aplikacija/ (#2028 §3.1). `/` is the app's landing page.
  if (!html.includes(`href="${appBase}/prijava"`)) throw new Error('na /ulaz nije prvi ekran Preloadera');
}

async function checkShippedApp(response: Response) {
  const html = await response.text();
  // The production build of packages/app asks for its files under /aplikacija/_next/ (basePath).
  if (!html.includes('/aplikacija/_next/')) throw new Error('na /aplikacija/ nije izgradnja packages/app');
}

export function revision(directory: string, repo: string) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(`INT-10: ne mogu očitati Git HEAD za ${repo} u ${directory}. ` +
      'STOG_SERVER_DIR i STOG_PRELOADER_DIR trebaju pokazivati na checkoute iz kojih je stog pokrenut.');
  }
}

export const serverRoot = () => resolve(webRoot, process.env.STOG_SERVER_DIR?.trim() || '../Institution_server');
export const preloaderRoot = () => resolve(webRoot, process.env.STOG_PRELOADER_DIR?.trim() || '../Preloader');
export const repoRevisions = () => ({
  web: revision(webRoot, 'Institution_front_web_chrome'),
  server: revision(serverRoot(), 'Institution_server'),
  preloader: revision(preloaderRoot(), 'Preloader'),
});

export default async function setup() {
  await checkService(`${webOrigin}/ulaz`, 'Preloader (edge)', checkPreloader);
  await checkService(`${webOrigin}${appBase}/stanje`, 'packages/app (edge)', checkShippedApp);
  await checkService(serverHealthUrl, 'Institution_server', checkHealth);
  await checkService(`${webOrigin}/api/v1/health`, 'edge → Institution_server', checkHealth);
  await checkService(`${oidcOrigin}/.well-known/openid-configuration`, 'Simulator AAI@EduHr', async (response) => {
    const discovery = await response.json();
    if (discovery.issuer !== oidcOrigin) throw new Error('neočekivan OIDC izdavatelj');
  });

  const shas = repoRevisions();
  console.log(`INT-10 WEB SHA ${shas.web}`);
  console.log(`INT-10 SRV SHA ${shas.server}`);
  console.log(`INT-10 PRELOADER SHA ${shas.preloader}`);
  console.log(`INT-10 HOST ${shippedHost} na ${webOrigin}${appBase}/`);
}
