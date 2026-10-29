import { fixtures, engines, fixtureDir } from './fixtures';
import { capabilities, defaults } from '../src/shared/capabilities';
import { join } from 'node:path';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyOutput } from './verify-output';
await fixtures();
await mkdir('output/matrix', { recursive: true });
type Result = { id: string; status: 'pass' | 'fail' | 'unverified'; error?: string; elapsedMs: number };
const results: Result[] = [];
const selected = process.env.AIO_MATRIX_FAMILY ? capabilities.filter(c => process.env.AIO_MATRIX_FAMILY!.split(',').includes(c.family)) : capabilities;
const limit = process.env.AIO_MATRIX_LIMIT ? Number(process.env.AIO_MATRIX_LIMIT) : selected.length;
const codeHash = createHash('sha256');
for (const file of ['src/core/engines.ts', 'src/core/process.ts', 'src/shared/capabilities.ts', 'scripts/verify-output.ts']) codeHash.update(await readFile(file));
const codeDigest = codeHash.digest('hex');
const engineDigests = new Map<string, string>();
for (const route of selected) if (!engineDigests.has(route.engine)) engineDigests.set(route.engine, await readFile(engines.exe(route.engine)).then(b => createHash('sha256').update(b).digest('hex'), () => 'missing'));
let next = 0;
async function worker() {
  while (next < Math.min(limit, selected.length)) {
    const route = selected[next++]; const start = Date.now(); const source = join(fixtureDir, `sample.${route.input}`);
    const exists = await stat(source).then(() => true, () => false);
    if (!exists) { results.push({ id: route.id, status: 'unverified', error: 'No fixture available', elapsedMs: 0 }); continue; }
    const hash = createHash('sha256').update(await readFile(source)).digest('hex');
    const fingerprint = `${hash}:${engineDigests.get(route.engine)}:${codeDigest}`;
    const record = `output/matrix/${route.input}-${route.output}.json`;
    try {
      const cached = JSON.parse(await readFile(record, 'utf8'));
      if (cached.fingerprint === fingerprint && cached.result.status === 'pass') { results.push(cached.result); console.log(`PASS ${route.id} (verified cache)`); continue; }
    } catch {}
    try {
      const result = await engines.convert(route, source, join(fixtureDir, `matrix-${route.input}-${route.output}-${start}`), { ...defaults, acknowledgeLoss: true }, { signal: new AbortController().signal });
      if (!result.folder && !(await stat(result.path)).size) throw new Error('Empty output');
      await verifyOutput(engines, route, result);
      if (createHash('sha256').update(await readFile(source)).digest('hex') !== hash) throw new Error('Source modified');
      results.push({ id: route.id, status: 'pass', elapsedMs: Date.now() - start });
      console.log(`PASS ${route.id}`);
    } catch (error) { results.push({ id: route.id, status: 'fail', error: String(error), elapsedMs: Date.now() - start }); console.log(`FAIL ${route.id}: ${String(error).slice(0, 180)}`); }
    const result = results.find(r => r.id === route.id); await writeFile(record, JSON.stringify({ fingerprint, result }, null, 2));
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
const summary = { scope: process.env.AIO_MATRIX_FAMILY ?? 'all', totalAdvertised: selected.length, tested: results.length, passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status === 'fail').length, unverified: results.filter(r => r.status === 'unverified').length, results };
await writeFile('output/matrix/results.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }));
if (summary.failed || summary.unverified || summary.tested !== summary.totalAdvertised) process.exitCode = 1;
