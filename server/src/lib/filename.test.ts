import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeDownloadName, contentDisposition } from './filename.ts';

test('strips path separators and unsafe characters', () => {
  const traversal = safeDownloadName('../../etc/passwd', 'mp4');
  assert.equal(traversal, '..-..-etc-passwd.mp4');
  assert.ok(!traversal.includes('/') && !traversal.includes('\\'));
  assert.equal(safeDownloadName('a/b\\c', 'mp3'), 'a-b-c.mp3');
  assert.equal(safeDownloadName('a<b>c:"|?*', 'mp4'), 'abc.mp4');
});

test('falls back to a default when empty', () => {
  assert.equal(safeDownloadName('   ', 'mp4'), 'download.mp4');
});

test('removes control characters from titles', () => {
  assert.equal(safeDownloadName('line1\r\nline2', 'mp3'), 'line1 line2.mp3');
});

test('content-disposition strips CR/LF and includes both forms', () => {
  const header = contentDisposition('Song \r\nInjection.mp3');
  assert.ok(!header.includes('\r'));
  assert.ok(!header.includes('\n'));
  assert.match(header, /^attachment; filename="/);
  assert.match(header, /filename\*=UTF-8''/);
});

test('content-disposition encodes unicode safely', () => {
  const header = contentDisposition('café — song.mp3');
  assert.match(header, /filename\*=UTF-8''/);
  // ASCII fallback must contain only ASCII.
  const ascii = header.match(/filename="([^"]*)"/)?.[1] ?? '';
  assert.ok(/^[\x20-\x7E]*$/.test(ascii));
});
