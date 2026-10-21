#!/usr/bin/env node
/**
 * Starts the app and opens the studio straight into a demo-shop scan.
 * The demo shop is the built-in checkout fixture, so it needs no network and
 * returns the same numbers on every run.
 */
import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';

const WEB_URL = 'http://127.0.0.1:5173/#demo';
const API_URL = 'http://127.0.0.1:4317/api/health';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function up(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, label, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    if (await up(url)) return true;
    await wait(1000);
  }
  throw new Error(`${label} did not start. Run "npm run dev" in another terminal and open ${WEB_URL}.`);
}

const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' });
const stop = () => { child.kill('SIGINT'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  await waitFor(API_URL, 'The local scanner');
  await waitFor('http://127.0.0.1:5173/', 'The studio');
  console.log(`\nAccessRipple is ready. Opening ${WEB_URL}\n`);
  exec(`open "${WEB_URL}"`, () => {});
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stop();
}
