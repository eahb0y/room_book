import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PREVIEW_STARTUP_TIMEOUT_MS = 30_000;
const PREVIEW_SHUTDOWN_TIMEOUT_MS = 5_000;
const host = process.env.SMOKE_HOST ?? '127.0.0.1';
const port = Number(process.env.SMOKE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args) {
  return spawn(command, args, { stdio: 'inherit' });
}

async function ensureDistExists() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(scriptDir, '..', 'dist');
  await access(distDir);
}

async function waitForPreview(previewProcess) {
  const startTime = Date.now();

  while (Date.now() - startTime < PREVIEW_STARTUP_TIMEOUT_MS) {
    if (previewProcess.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${previewProcess.exitCode}.`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Ignore retries while preview server is starting.
    }

    await delay(500);
  }

  throw new Error(`Preview server did not start within ${PREVIEW_STARTUP_TIMEOUT_MS / 1000} seconds.`);
}

async function runSmokeChecks() {
  const [homeResponse, loginResponse] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/login`),
  ]);

  assert(homeResponse.ok, `Expected GET / to return 2xx, got ${homeResponse.status}.`);
  assert(loginResponse.ok, `Expected GET /login to return 2xx, got ${loginResponse.status}.`);

  const homeContentType = homeResponse.headers.get('content-type') ?? '';
  assert(
    homeContentType.includes('text/html'),
    `Expected / content type to include text/html, got "${homeContentType}".`
  );

  const [homeHtml, loginHtml] = await Promise.all([
    homeResponse.text(),
    loginResponse.text(),
  ]);

  assert(homeHtml.includes('<div id="root"></div>'), 'Expected root container on /.');
  assert(loginHtml.includes('<div id="root"></div>'), 'Expected SPA fallback root container on /login.');
}

async function stopPreview(previewProcess) {
  if (previewProcess.exitCode !== null) return;

  previewProcess.kill('SIGTERM');

  const exitPromise = once(previewProcess, 'exit');
  const timeoutPromise = delay(PREVIEW_SHUTDOWN_TIMEOUT_MS).then(() => {
    if (previewProcess.exitCode === null) {
      previewProcess.kill('SIGKILL');
    }
  });

  await Promise.race([exitPromise, timeoutPromise]);
  if (previewProcess.exitCode === null) {
    await exitPromise;
  }
}

async function main() {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SMOKE_PORT must be a positive integer, got "${port}".`);
  }

  await ensureDistExists();

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const previewProcess = runCommand(npmCommand, [
    'run',
    'preview',
    '--',
    '--host',
    host,
    '--port',
    String(port),
  ]);

  try {
    await waitForPreview(previewProcess);
    await runSmokeChecks();
    console.log('Smoke e2e checks passed.');
  } finally {
    await stopPreview(previewProcess);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke e2e checks failed: ${message}`);
  process.exit(1);
});
