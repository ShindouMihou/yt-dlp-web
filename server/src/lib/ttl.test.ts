import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTtlMs } from './ttl.ts';

const MIN = 30 * 60_000;
const MAX = 60 * 60_000;
const PER_BYTE = (20 * 60_000) / (1024 * 1024 * 1024);

test('small files get approximately the minimum TTL', () => {
  const ttl = computeTtlMs(1024, MIN, MAX, PER_BYTE);
  assert.ok(ttl >= MIN && ttl < MIN + 1000);
});

test('large files stretch toward the maximum TTL', () => {
  const big = computeTtlMs(5 * 1024 * 1024 * 1024, MIN, MAX, PER_BYTE);
  assert.equal(big, MAX);
});

test('mid-size files scale between min and max', () => {
  const mid = computeTtlMs(1024 * 1024 * 1024, MIN, MAX, PER_BYTE);
  assert.ok(mid > MIN && mid <= MAX);
});

test('negative size is clamped to the minimum', () => {
  assert.equal(computeTtlMs(-100, MIN, MAX, PER_BYTE), MIN);
});
