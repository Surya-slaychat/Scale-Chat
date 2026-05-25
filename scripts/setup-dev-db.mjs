#!/usr/bin/env node
/**
 * One-shot dev-database bootstrap.
 *
 * Brings the local development stack up to the current schema:
 *   1. Starts the `scalechat-pg` + `scalechat-redis` Docker containers (idempotent).
 *   2. Waits for Postgres to accept connections (~15s budget).
 *   3. Applies pending Prisma migrations with `prisma migrate deploy`
 *      (production-safe — never prompts, never resets).
 *   4. Regenerates the Prisma client.
 *   5. Rebuilds `@scalechat/shared` so the API + mobile pick up any new zod
 *      schemas that landed alongside the migration.
 *
 * Every step is idempotent — re-running the script when everything is already
 * up just confirms the state.
 *
 * Flags:
 *   --dry-run            Print each step without executing it.
 *   --no-docker          Skip docker; assumes Postgres + Redis are already reachable.
 *   --skip-shared        Skip the `npm run shared:build` step.
 *   --create-containers  When `scalechat-pg` / `scalechat-redis` are missing, run
 *                        `docker run -d --name … -p …:… <image>` to create them.
 *                        Volumes persist across restarts. Ports + creds match
 *                        `apps/api/.env`: PG on host :5433 (container :5432),
 *                        Redis on host :6380 (container :6379), user/pass/db
 *                        all "scalechat".
 *
 * Wire-up:
 *   npm run db:setup                              # full run (assumes containers exist)
 *   npm run db:setup -- --create-containers       # first-time install — creates the containers too
 *   npm run db:setup:dry                          # walk through every step
 *
 * Exit codes: 0 success, 1 any step failed, 2 invalid invocation.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = dirname(__dirname);
const apiDir = join(repoRoot, 'apps', 'api');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const noDocker = args.has('--no-docker');
const skipShared = args.has('--skip-shared');
const createContainers = args.has('--create-containers');

const PG_CONTAINER = 'scalechat-pg';
const REDIS_CONTAINER = 'scalechat-redis';
// User+db from apps/api/.env (DATABASE_URL=postgresql://scalechat:scalechat@localhost:5433/scalechat).
const PG_USER = 'scalechat';
const PG_PASSWORD = 'scalechat';
const PG_DB = 'scalechat';
const PG_HOST_PORT = '5433';
const REDIS_HOST_PORT = '6380';
const PG_IMAGE = 'postgres:16';
const REDIS_IMAGE = 'redis:7';

function log(tag, msg) {
  const t = `[${new Date().toISOString().slice(11, 19)}] [setup-dev-db]`;
  process.stdout.write(`${t} ${tag} ${msg}\n`);
}

function fail(msg) {
  log('FAIL', msg);
  process.exitCode = 1;
}

/**
 * Run a command sync; respects --dry-run. Returns { status, stdout, stderr }.
 *
 * Note on inherit mode: even when `opts.inherit` is true we still capture
 * stderr (and stdout when not inherited) so callers can surface the failure
 * reason. On Windows + `.cmd` wrappers, inherit-only mode tends to swallow
 * non-zero exits silently — keeping a copy here means the script can always
 * print *why* it failed.
 */
function run(cmd, argv, opts = {}) {
  const pretty = `${cmd} ${argv.join(' ')}`;
  if (dryRun) {
    log('DRY', pretty);
    return { status: 0, stdout: '', stderr: '' };
  }
  log('RUN', pretty);
  // On Windows we need `shell: true` to resolve `.cmd` wrappers (npx, npm).
  // POSIX systems work either way; shell: true gives us consistent quoting.
  const useShell = process.platform === 'win32';
  const res = spawnSync(cmd, argv, {
    encoding: 'utf8',
    shell: useShell,
    stdio: opts.inherit ? ['inherit', 'inherit', 'pipe'] : 'pipe',
    cwd: opts.cwd,
  });
  if (res.error) {
    return { status: 1, stdout: '', stderr: String(res.error.message ?? res.error) };
  }
  return {
    status: res.status ?? 0,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

function dockerCli() {
  // On Windows `docker` is `docker.exe` in PATH; on macOS / Linux just `docker`.
  // `spawnSync('docker', …)` resolves both as long as docker is on PATH.
  return 'docker';
}

/**
 * Verify the Docker daemon is reachable. The CLI binary may exist (so
 * `docker --version` works) while the engine is stopped — common on Windows
 * when Docker Desktop hasn't been launched yet. `docker info` round-trips to
 * the daemon, so it fails fast with a clear error in that state.
 */
function checkDaemonRunning() {
  const info = run(dockerCli(), ['info', '--format', '{{.ServerVersion}}']);
  if (info.status === 0 && info.stdout.trim().length > 0) return true;
  const combined = `${info.stderr}\n${info.stdout}`.toLowerCase();
  if (
    combined.includes('docker daemon') ||
    combined.includes('dockerdesktoplinuxengine') ||
    combined.includes('cannot connect to the docker daemon') ||
    combined.includes('pipe') ||
    combined.includes('engine')
  ) {
    log('FAIL', 'Docker is installed but the daemon is not running.');
    if (process.platform === 'win32') {
      log('HINT', 'Open "Docker Desktop" from the Start menu and wait until the system-tray icon turns green, then re-run this script.');
    } else if (process.platform === 'darwin') {
      log('HINT', 'Open "Docker Desktop" from /Applications and wait for the menu-bar icon to settle, then re-run this script.');
    } else {
      log('HINT', 'Start the daemon with `sudo systemctl start docker` (Linux) and re-run this script.');
    }
    return false;
  }
  log('FAIL', `docker info exited non-zero: ${info.stderr.trim() || 'unknown'}`);
  return false;
}

/** Args for `docker run -d` per container — matched to apps/api/.env. */
const CONTAINER_CREATE_ARGS = {
  [PG_CONTAINER]: [
    '-d',
    '--name', PG_CONTAINER,
    '-p', `${PG_HOST_PORT}:5432`,
    '-e', `POSTGRES_DB=${PG_DB}`,
    '-e', `POSTGRES_USER=${PG_USER}`,
    '-e', `POSTGRES_PASSWORD=${PG_PASSWORD}`,
    '-v', 'scalechat-pg-data:/var/lib/postgresql/data',
    PG_IMAGE,
  ],
  [REDIS_CONTAINER]: [
    '-d',
    '--name', REDIS_CONTAINER,
    '-p', `${REDIS_HOST_PORT}:6379`,
    REDIS_IMAGE,
  ],
};

/** Pretty-print the canonical `docker run` command for missing containers. */
function printCreateHint(name) {
  const cmd = ['docker', 'run', ...CONTAINER_CREATE_ARGS[name]].join(' ');
  log('HINT', `to create it manually: ${cmd}`);
}

function ensureContainerStarted(name) {
  const inspect = run(dockerCli(), ['inspect', '--format', '{{.State.Status}}', name]);
  if (inspect.status !== 0) {
    if (createContainers) {
      log('INFO', `${name} not found — creating it (--create-containers)`);
      const created = run(dockerCli(), ['run', ...CONTAINER_CREATE_ARGS[name]], { inherit: true });
      if (created.status !== 0) {
        log('FAIL', `docker run for ${name} exited non-zero`);
        return false;
      }
      log('OK ', `created ${name}`);
      return true;
    }
    log(
      'WARN',
      `container "${name}" not found. Re-run with \`npm run db:setup -- --create-containers\` to create it automatically.`,
    );
    printCreateHint(name);
    return false;
  }
  const status = inspect.stdout.trim();
  if (status === 'running') {
    log('OK ', `${name} already running`);
    return true;
  }
  const start = run(dockerCli(), ['start', name]);
  if (start.status !== 0) {
    log('FAIL', `docker start ${name} → ${start.stderr.trim() || 'unknown'}`);
    return false;
  }
  log('OK ', `started ${name}`);
  return true;
}

async function waitForPg() {
  // pg_isready inside the container talks to Postgres on its native port,
  // so we don't need to know the host-side 5433 mapping.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const probe = run(dockerCli(), [
      'exec',
      PG_CONTAINER,
      'pg_isready',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
      '-q',
    ]);
    if (probe.status === 0) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  log('INFO', `repo: ${repoRoot}`);
  if (dryRun) log('INFO', 'dry-run mode — no changes will be made');
  if (noDocker) log('INFO', '--no-docker: assuming containers are already running');
  if (skipShared) log('INFO', '--skip-shared: will not rebuild @scalechat/shared');

  if (!existsSync(join(apiDir, 'prisma', 'schema.prisma'))) {
    fail(`apps/api/prisma/schema.prisma not found — wrong working directory?`);
    return;
  }

  // ─── Step 1: containers ───────────────────────────────────────────────────
  if (!noDocker) {
    log('STEP', '1/5 starting Docker containers');
    // Probe the daemon before running container commands so we fail fast with
    // a clear "Docker Desktop is not running" message instead of two npipe
    // errors after we've already attempted things.
    if (!dryRun && !checkDaemonRunning()) {
      process.exitCode = 1;
      return;
    }
    const pgOk = ensureContainerStarted(PG_CONTAINER);
    const redisOk = ensureContainerStarted(REDIS_CONTAINER);
    if (!pgOk) {
      fail(
        'Postgres container unavailable. Run `npm run db:setup -- --create-containers` to create it, or `--no-docker` if your DB lives elsewhere.',
      );
      return;
    }
    if (!redisOk) {
      log('WARN', `${REDIS_CONTAINER} unavailable. Migrations will still apply, but the API gateway and OTP service need Redis at runtime.`);
    }

    // ─── Step 2: wait for Postgres ──────────────────────────────────────────
    log('STEP', '2/5 waiting for Postgres');
    if (dryRun) {
      log('DRY', 'pg_isready loop (15s budget)');
    } else {
      const ready = await waitForPg();
      if (!ready) {
        fail(`${PG_CONTAINER} did not accept connections within 15s. Check 'docker logs ${PG_CONTAINER}'.`);
        return;
      }
      log('OK ', 'Postgres is ready');
    }
  } else {
    log('STEP', '1-2/5 skipping container startup + readiness probe (--no-docker)');
  }

  // Windows note: `spawnSync` with `shell: false` cannot resolve `npx` →
  // `npx.cmd`. Same for `npm`. Use the platform-specific binary explicitly
  // so prisma's stdout/stderr actually reach the terminal instead of the
  // process exiting immediately with an opaque "exited non-zero".
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';

  /** Run a step that emits its own output; on failure, dump captured stderr. */
  function runStep(label, cmd, argv, opts = {}) {
    const res = run(cmd, argv, { ...opts, inherit: true });
    if (res.status !== 0) {
      if (res.stderr.trim().length > 0) log('STDERR', res.stderr.trim());
      fail(`${label} exited non-zero (status ${res.status})`);
    }
    return res.status === 0;
  }

  // ─── Step 3: apply migrations ─────────────────────────────────────────────
  log('STEP', '3/5 applying pending Prisma migrations');
  if (!runStep('prisma migrate deploy', npxCmd, ['prisma', 'migrate', 'deploy'], { cwd: apiDir })) return;
  log('OK ', 'migrations applied');

  // ─── Step 4: regenerate Prisma client ─────────────────────────────────────
  log('STEP', '4/5 regenerating Prisma client');
  const gen = run(npxCmd, ['prisma', 'generate'], { cwd: apiDir, inherit: true });
  if (gen.status !== 0) {
    const combined = gen.stderr.toLowerCase();
    if (combined.includes('eperm') || combined.includes('query_engine')) {
      log('WARN', "prisma generate couldn't replace the query engine — looks like `npm run api:dev` is running and has the DLL locked.");
      log('HINT', 'Stop the API (Ctrl-C in its terminal), then re-run `npm run db:setup`. The migration has already been applied to the DB; only the client regen is pending.');
    } else if (gen.stderr.trim().length > 0) {
      log('STDERR', gen.stderr.trim());
    }
    fail(`prisma generate exited non-zero (status ${gen.status})`);
    return;
  }
  log('OK ', 'Prisma client regenerated');

  // ─── Step 5: rebuild shared package ───────────────────────────────────────
  if (!skipShared) {
    log('STEP', '5/5 rebuilding @scalechat/shared');
    if (!runStep('shared:build', npmCmd, ['run', 'shared:build'], { cwd: repoRoot })) return;
    log('OK ', 'shared package rebuilt');
  } else {
    log('STEP', '5/5 skipping shared:build');
  }

  log('DONE', 'database is ready. Next: npm run api:dev   (and  cd my-app && npx expo start --dev-client)');
}

await main();
