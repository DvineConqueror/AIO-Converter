import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDownload, publicAddress, downloadName, Downloads } from '../src/core/downloads';
import { Engines } from '../src/core/engines';

const request = { url: 'https://www.youtube.com/watch?v=abc', kind: 'Video', format: 'mp4', quality: '1080' };
test('download boundary accepts only supported settings and public HTTP links', () => {
  assert.equal(validateDownload(request).format, 'mp4');
  assert.equal(validateDownload({ ...request, kind: 'Audio', format: 'mp3' }).kind, 'Audio');
  for (const url of ['file:///C:/secret.mp4', 'ftp://example.com/x', 'http://127.0.0.1/x', 'http://169.254.169.254/x', 'http://localhost/x', 'https://user:pass@example.com', 'https://example.com:9000/x', 'http://[::ffff:127.0.0.1]/x', '--exec calc']) assert.throws(() => validateDownload({ ...request, url }), url);
  for (const bad of [null, {}, { ...request, kind: 'Other' }, { ...request, format: 'exe' }, { ...request, quality: '4000' }, { ...request, args: ['--exec', 'calc'] }]) assert.throws(() => validateDownload(bad));
});
test('DNS address guard rejects local and transition addresses', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.16.1.2', '192.168.1.1', '100.64.1.1', '169.254.169.254', '224.0.0.1', '::1', 'fe80::1', '::ffff:8.8.8.8', '2002:0808:0808::1']) assert.equal(publicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4828:400::']) assert.equal(publicAddress(address), true, address);
});
test('remote titles become bounded Windows filenames', () => {
  assert.equal(downloadName('../CON:<video>|?*'), '.._CON__video____');
  assert.equal(downloadName('NUL.mp4'), 'Download_NUL.mp4');
  assert.equal(downloadName('hello... '), 'hello');
  assert.ok(downloadName('x'.repeat(400)).length <= 120);
  assert.ok(downloadName('').startsWith('Download_'));
});
test('missing bundled download tools fail without enqueuing', async () => {
  const queue = new Downloads(new Engines('nonexistent-test-tools'), () => 'unused');
  await assert.rejects(queue.add(request), /missing/);
  assert.deepEqual(queue.snapshot(), []);
  assert.throws(() => queue.get('missing'), /no longer exists/);
  await queue.close();
});
