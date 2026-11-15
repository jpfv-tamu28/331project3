import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.LT_BIN,
  path.join(root, 'lt-env', 'bin', 'libretranslate'),            // Linux/macOS/WSL venv
  path.join(root, 'lt-env', 'Scripts', 'libretranslate.exe'),    // native Windows venv
].filter(Boolean);

const bin = candidates.find((c) => existsSync(c)) ?? 'libretranslate';
const child = spawn(bin, ['--load-only', 'en,es,fr,de'], { stdio: 'inherit' });

child.on('error', () => console.log('LibreTranslate not found, translation disabled'));
child.on('exit', (code) => {
  if (code) console.log(`LibreTranslate exited with code ${code}, translation disabled`);
});