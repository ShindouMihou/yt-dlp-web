import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSelection, buildFormatArgs } from './format.ts';

test('parses valid selections', () => {
  assert.deepEqual(parseSelection({ kind: 'video' }), { kind: 'video' });
  assert.deepEqual(parseSelection({ kind: 'audio' }), { kind: 'audio' });
  assert.deepEqual(parseSelection({ kind: 'video', maxHeight: 1080 }), {
    kind: 'video',
    maxHeight: 1080,
  });
});

test('rejects invalid selections', () => {
  assert.equal(parseSelection(null), null);
  assert.equal(parseSelection({ kind: 'gif' }), null);
  assert.equal(parseSelection({ kind: 'video', maxHeight: 999 }), null);
  assert.equal(parseSelection({ kind: 'video', maxHeight: '1080' }), null);
  assert.equal(parseSelection('video'), null);
});

test('video preset prefers mp4-muxable streams', () => {
  const { args, expectedExt } = buildFormatArgs({ kind: 'video' });
  assert.equal(expectedExt, 'mp4');
  assert.ok(args.includes('--merge-output-format'));
  const sortIdx = args.indexOf('-S');
  assert.ok(sortIdx >= 0 && args[sortIdx + 1]?.includes('ext:mp4:m4a'));
});

test('video preset applies a resolution ceiling', () => {
  const { args } = buildFormatArgs({ kind: 'video', maxHeight: 720 });
  const sortIdx = args.indexOf('-S');
  assert.ok(args[sortIdx + 1]?.includes('res:720'));
});

test('audio preset extracts mp3', () => {
  const { args, expectedExt } = buildFormatArgs({ kind: 'audio' });
  assert.equal(expectedExt, 'mp3');
  assert.ok(args.includes('-x'));
  assert.ok(args.includes('mp3'));
});
