import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateYoutubeUrl, isAllowedThumbnailHost } from './url.ts';

test('accepts standard YouTube hosts', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=abc',
    'https://m.youtube.com/watch?v=abc',
    'youtube.com/shorts/abc',
  ]) {
    assert.equal(validateYoutubeUrl(url).ok, true, url);
  }
});

test('rejects look-alike and non-YouTube hosts', () => {
  for (const url of [
    'https://evil-youtube.com/watch?v=x',
    'https://youtube.com.evil.com/watch?v=x',
    'https://notyoutube.com/x',
    'https://vimeo.com/123',
    'https://youtube.com@evil.com/x',
    'not a url at all',
    '',
  ]) {
    assert.equal(validateYoutubeUrl(url).ok, false, url);
  }
});

test('rejects http, ports, and credentials', () => {
  assert.equal(validateYoutubeUrl('http://youtube.com/watch?v=x').ok, false);
  assert.equal(validateYoutubeUrl('https://youtube.com:8080/watch?v=x').ok, false);
  assert.equal(validateYoutubeUrl('https://user:pass@youtube.com/watch?v=x').ok, false);
});

test('rejects a URL that looks like a flag', () => {
  assert.equal(validateYoutubeUrl('--config-location=/etc/passwd').ok, false);
  assert.equal(validateYoutubeUrl('-i').ok, false);
});

test('thumbnail host allowlist', () => {
  assert.equal(isAllowedThumbnailHost('https://i.ytimg.com/vi/x/hq.jpg'), true);
  assert.equal(isAllowedThumbnailHost('https://yt3.ggpht.com/x'), true);
  assert.equal(isAllowedThumbnailHost('https://evil.com/x.jpg'), false);
  assert.equal(isAllowedThumbnailHost(null), false);
});
