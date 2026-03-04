#!/usr/bin/env node
/**
 * Fetch EAS build logs via CLI when the Expo dashboard won't load them.
 * Usage: node scripts/fetch-eas-logs.js [--platform android|ios] [--status errored|finished] [--limit N]
 *
 * Requires: EXPO_TOKEN in env or being logged in (npx eas login).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'android';
const status = args.includes('--status') ? args[args.indexOf('--status') + 1] : 'errored';
const limit = args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '1';

console.log(`Fetching latest ${status} ${platform} build(s)...\n`);

let listJson;
try {
  listJson = execSync(
    `npx eas build:list --platform ${platform} --status ${status} --limit ${limit} --json --non-interactive`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  );
} catch (e) {
  console.error('eas build:list failed. Are you logged in? Run: npx eas login');
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(1);
}

let builds;
try {
  builds = JSON.parse(listJson);
} catch {
  console.error('Could not parse EAS output. Run the command yourself:\n  npx eas build:list --platform android --status errored --limit 1 --json --non-interactive');
  process.exit(1);
}

if (!Array.isArray(builds) || builds.length === 0) {
  console.log(`No ${status} ${platform} builds found.`);
  process.exit(0);
}

const outDir = path.join(process.cwd(), 'build-logs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  for (const build of builds) {
    const id = build.id;
    const shortId = id.slice(0, 8);
    const dir = path.join(outDir, shortId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log('Build:', id);
    console.log('  Status:', build.status);
    console.log('  Platform:', build.platform);
    console.log('  Created:', build.createdAt);
    if (build.error) {
      console.log('  Error:', build.error.errorCode || '—', build.error.message || '');
    }
    console.log('  Log files:', build.logFiles?.length ?? 0);

    if (!build.logFiles?.length) {
      console.log('  (No log file URLs in response.)\n');
      continue;
    }

    for (let i = 0; i < build.logFiles.length; i++) {
      const url = build.logFiles[i];
      const name = `log-${i + 1}.txt`;
      const filePath = path.join(dir, name);
      try {
        const body = await download(url);
        fs.writeFileSync(filePath, body, 'utf-8');
        console.log('  Saved:', filePath);
      } catch (e) {
        console.log('  Failed to download', name, e.message);
      }
    }
    console.log('');
  }

  console.log('Logs saved under:', outDir);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
