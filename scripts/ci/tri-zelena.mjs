#!/usr/bin/env node
// Rule "3 zelena zaredom" (3 greens in a row): a test or job counts as stable,
// and a fix of an unstable one is accepted, only after it passed three times in
// a row on the same commit. This script runs the real CI job again on the same
// run (GitHub re-run, so the same commit, setup and runner image) until three
// consecutive attempts are green, and fails on the first attempt that is not.
//
// Stricter than CI, never weaker: an attempt is green only when every chosen
// job succeeded AND its log reports no Playwright "N flaky" (a test that passed
// only on its CI retry counts as a failure here).
//
// Usage (needs gh with rights to re-run workflows):
//   node scripts/ci/tri-zelena.mjs --run <run id> [--job <regex>] [--repo owner/name]
//   --job  regex over job names, e.g. '^app \(' or '^ui \(behaviour\)$';
//          without it the whole run is re-run and every job is judged.
// Exit 0: three green attempts in a row. Exit 1: an attempt was not green.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const NEEDED = 3;

/** True when a job log (GitHub timestamps included) reports a flaky Playwright test. */
export function hasFlaky(log) {
  return /^\S*\s*\d+ flaky\s*$/m.test(log.replace(/\x1b\[[0-9;]*m/g, ""));
}

/**
 * Judges one attempt. `jobs`: [{ name, conclusion, run_attempt, flaky }].
 * A chosen job must have succeeded (skipped only by the run's own path filter
 * in whole-run mode), must not be flaky and, after a re-run, must have run in
 * this very attempt. At least one chosen job must have succeeded.
 */
export function judgeAttempt(jobs, { pattern, attempt, fresh, wholeRun }) {
  const re = new RegExp(pattern);
  const chosen = jobs.filter((job) => re.test(job.name));
  const problems = [];
  if (!chosen.some((job) => job.conclusion === "success")) problems.push(`no job matching /${pattern}/ succeeded`);
  for (const job of chosen) {
    if (job.conclusion === "skipped" && wholeRun) continue;
    if (job.conclusion !== "success") problems.push(`${job.name}: ${job.conclusion}`);
    else if (job.flaky) problems.push(`${job.name}: flaky (passed only on a retry)`);
    if (fresh && job.run_attempt !== attempt) problems.push(`${job.name}: not run in attempt ${attempt}`);
  }
  return { green: problems.length === 0, chosen: chosen.map((job) => job.name), problems };
}

export function parseArgs(argv) {
  const args = { run: "", job: "", repo: "", interval: 30 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (!(key in args) || argv[i + 1] === undefined) throw new Error(`unknown or empty argument: ${argv[i]}`);
    args[key] = key === "interval" ? Number(argv[++i]) : argv[++i];
  }
  if (!/^\d+$/.test(args.run)) throw new Error("--run <numeric run id> is required");
  if (args.job) new RegExp(args.job);
  return args;
}

const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const api = (path, ...a) => JSON.parse(gh("api", path, ...a));
const sleep = (s) => new Promise((done) => setTimeout(done, s * 1000));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = args.repo || gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").trim();
  const runPath = `repos/${repo}/actions/runs/${args.run}`;
  const wholeRun = !args.job;
  const pattern = args.job || ".*";
  let greens = 0;
  let last = 0;
  for (;;) {
    const run = api(runPath);
    if (run.status !== "completed" || run.run_attempt === last) {
      await sleep(args.interval);
      continue;
    }
    last = run.run_attempt;
    const re = new RegExp(pattern);
    const jobs = api(`${runPath}/attempts/${last}/jobs?per_page=100`).jobs.map((job) => ({
      ...job,
      flaky:
        job.conclusion === "success" &&
        re.test(job.name) &&
        hasFlaky(gh("api", "--allow-escape-sequences", `repos/${repo}/actions/jobs/${job.id}/logs`)),
    }));
    const verdict = judgeAttempt(jobs, { pattern, attempt: last, fresh: greens > 0, wholeRun });
    const sha = run.head_sha.slice(0, 8);
    if (!verdict.green) {
      console.log(`RED   attempt ${last} @ ${sha}: ${verdict.problems.join("; ")}`);
      console.log(`3 zelena: NOT met (${greens} green in a row before this attempt) ${run.html_url}`);
      process.exit(1);
    }
    greens += 1;
    console.log(`GREEN attempt ${last} @ ${sha} (${greens}/${NEEDED}): ${verdict.chosen.join(", ")}`);
    if (greens === NEEDED) {
      console.log(`3 zelena: met on ${sha} ${run.html_url}`);
      return;
    }
    // One chosen job: re-run it (and what needs it, e.g. ci-ok). Several: GitHub
    // re-runs one job at a time only on a finished run, so re-run the whole run.
    const chosen = jobs.filter((job) => re.test(job.name));
    if (!wholeRun && chosen.length === 1) gh("api", "-X", "POST", `repos/${repo}/actions/jobs/${chosen[0].id}/rerun`);
    else gh("api", "-X", "POST", `${runPath}/rerun`);
    await sleep(args.interval);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`tri-zelena: ${error.message}`);
    process.exit(2);
  });
}
