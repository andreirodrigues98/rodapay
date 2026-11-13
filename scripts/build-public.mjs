import { cp, copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-public');
const files = [
  'index.html','app.js','auth.js','dashboard.js','data.js','driving.js',
  'firebase.js','goals.js','manifest.json','premium.css','profile.js',
  'settings.js','style.css','transactions.js','utils.js',
  'legal.js','legal-policy.mjs','legal-style.css','termos.html','privacidade.html'
];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) await copyFile(join(root, file), join(out, file));
await cp(join(root, 'img'), join(out, 'img'), { recursive: true });
const indexFile = join(out, 'index.html');
let index = await readFile(indexFile, 'utf8');
index = index.replace(/\s*<div id="localDevBanner"[\s\S]*?<\/div>/, '');
index = index.replace(/\s*<button class="btn ghost hidden" type="button" id="createTestAccount">[\s\S]*?<\/button>/, '');
await writeFile(indexFile, index);
await writeFile(join(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/index.html\n  Cache-Control: no-cache\n`);
console.log('Publicação preparada em dist-public (sem arquivos ou chaves administrativas).');
