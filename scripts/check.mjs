import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';

const generated = new Set(['dist/cloud/client.bundle.js', 'dist/sw.js', 'dist/reading/catalog.js']);
const folders = ['dist', 'scripts', 'tests', 'worker'];
const files = ['server.mjs', 'playwright.config.js'];

function collect(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (['vendor', 'server', '.openai'].includes(entry.name)) continue;
    const path = join(directory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) collect(path);
    else if (/\.m?js$/.test(path) && !generated.has(path)) files.push(path);
  }
}

folders.forEach(collect);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Checked syntax in ' + files.length + ' source files.');
