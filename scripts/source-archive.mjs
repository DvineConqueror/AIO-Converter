import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const file = `AIO-Converter-Source-${version}.zip`;
const inputs = ['src', 'scripts', 'tests', 'docs', 'public', '.impeccable', '.github', '.gitignore', '.gitattributes', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'engines.lock.json', 'LICENSE', 'README.md', 'PRODUCT.md', 'DESIGN.md', 'SUPPORTED-FORMATS.md', 'THIRD-PARTY-NOTICES.md', 'RELEASE-CHECKLIST.md', 'VERIFICATION.md'];
await new Promise((res, rej) => {
  const p = spawn(resolve('vendor/sevenzip/7z.exe'), ['a', '-tzip', resolve('release', file), ...inputs], { shell: false, windowsHide: true, stdio: 'inherit' });
  p.on('error', rej); p.on('close', code => code === 0 ? res() : rej(new Error(`Archive failed: ${code}`)));
});
const hash = createHash('sha256').update(await readFile(`release/${file}`)).digest('hex');
await writeFile(`release/${file}.sha256`, `${hash}  ${file}\n`);
