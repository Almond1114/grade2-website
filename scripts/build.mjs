// GitHub Pagesは引き続きルートの静的ファイルを利用できます。
// ローカル検証・静的配信には npm run build で dist/ を生成します。
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:html|css|js|webmanifest)$/.test(entry.name) && !entry.name.includes('.backup.')) {
    await cp(path.join(root, entry.name), path.join(output, entry.name));
  }
  if (entry.isDirectory() && ['icons', 'fps-game', 'neon-arena', 'nankosai-seiryo'].includes(entry.name)) {
    await cp(path.join(root, entry.name), path.join(output, entry.name), { recursive: true });
  }
}
console.log('Static site built in dist/ (no external dependencies).');
