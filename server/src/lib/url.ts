const ALLOWED_HOSTS = new Set<string>([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface UrlValidationOk {
  ok: true;
  canonical: string;
}

export interface UrlValidationErr {
  ok: false;
}

export type UrlValidation = UrlValidationOk | UrlValidationErr;

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function validateYoutubeUrl(raw: string): UrlValidation {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return { ok: false };

  let parsed: URL;
  try {
    parsed = new URL(normalizeInput(raw));
  } catch {
    return { ok: false };
  }

  if (parsed.protocol !== 'https:') return { ok: false };
  if (parsed.username !== '' || parsed.password !== '') return { ok: false };
  if (parsed.port !== '') return { ok: false };
  if (parsed.hostname.includes('@')) return { ok: false };
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return { ok: false };

  return { ok: true, canonical: parsed.toString() };
}

export function isAllowedThumbnailHost(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'i.ytimg.com' || u.hostname.endsWith('.ggpht.com');
  } catch {
    return false;
  }
}
