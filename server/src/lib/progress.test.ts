import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgressLine, stageForPostprocessor } from './progress.ts';

test('parses a download line with full data', () => {
  const parsed = parseProgressLine('DLP|v1|downloading|1048576|10485760|10485760|524288|18');
  assert.deepEqual(parsed, {
    type: 'download',
    status: 'downloading',
    downloadedBytes: 1048576,
    totalBytes: 10485760,
    speedBytesPerSec: 524288,
    etaSeconds: 18,
  });
});

test('treats NA as null and falls back to estimate', () => {
  const parsed = parseProgressLine('DLP|v1|downloading|2048|NA|4096|NA|NA');
  assert.equal(parsed?.type, 'download');
  if (parsed?.type === 'download') {
    assert.equal(parsed.totalBytes, 4096);
    assert.equal(parsed.speedBytesPerSec, null);
    assert.equal(parsed.etaSeconds, null);
  }
});

test('returns null totals when both are NA', () => {
  const parsed = parseProgressLine('DLP|v1|downloading|2048|NA|NA|100|5');
  if (parsed?.type === 'download') assert.equal(parsed.totalBytes, null);
});

test('parses a postprocessor line', () => {
  const parsed = parseProgressLine('PP|v1|started|Merger');
  assert.deepEqual(parsed, { type: 'postprocessor', status: 'started', postprocessor: 'Merger' });
});

test('ignores unrelated lines', () => {
  assert.equal(parseProgressLine('[youtube] Extracting URL'), null);
  assert.equal(parseProgressLine(''), null);
});

test('maps postprocessor names to stages', () => {
  assert.equal(stageForPostprocessor('Merger'), 'merging');
  assert.equal(stageForPostprocessor('ExtractAudio'), 'converting');
  assert.equal(stageForPostprocessor('VideoConvertor'), 'converting');
});
