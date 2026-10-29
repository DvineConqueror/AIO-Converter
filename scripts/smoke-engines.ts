import { fixtures, engines, fixtureDir, context } from './fixtures';
import { capability, defaults } from '../src/shared/capabilities';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
await fixtures();
const results = [];
for (const [input, output] of [['png', 'webp'], ['wav', 'mp3'], ['mp4', 'webm'], ['docx', 'pdf'], ['pdf', 'png'], ['md', 'epub'], ['zip', '7z']]) {
  const start = Date.now();
  const result = await engines.convert(capability(input, output), join(fixtureDir, `sample.${input}`), join(fixtureDir, `smoke-${input}-${output}-${Date.now()}`), { ...defaults, acknowledgeLoss: true }, context);
  results.push({ input, output, path: result.path, elapsedMs: Date.now() - start }); console.log(`PASS ${input} → ${output}`);
}
await mkdir('output', { recursive: true }); await writeFile('output/smoke-results.json', JSON.stringify(results, null, 2));
