import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
for (const file of await readdir('release')) if (/Setup-.*\.exe$/.test(file)) {
  const hash = createHash('sha256').update(await readFile(`release/${file}`)).digest('hex');
  await writeFile(`release/${file}.sha256`, `${hash}  ${file}\n`);
  console.log(`${file}: ${hash}`);
}
