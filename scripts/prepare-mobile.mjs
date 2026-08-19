import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'mobile-www');

const excluded = new Set([
  '.git',
  '.github',
  'node_modules',
  'android',
  'ios',
  'mobile-www',
  'package.json',
  'package-lock.json',
  'capacitor.config.ts',
  'MOBILE_APP.md',
  'README.md'
]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  if (entry.name.startsWith('.')) continue;
  await cp(path.join(root, entry.name), path.join(out, entry.name), { recursive: true });
}

console.log(`Prepared Capacitor web assets in ${out}`);
