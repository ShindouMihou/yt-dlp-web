const MAX_BASENAME = 120;

export function safeDownloadName(title: string, ext: string): string {
  const base = title
    .replace(/[\r\n\t\0]/g, ' ')
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BASENAME)
    .trim();

  const clean = base.length > 0 ? base : 'download';
  return `${clean}.${ext}`;
}

function asciiFallback(filename: string): string {
  return filename
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'download';
}

export function contentDisposition(filename: string): string {
  const ascii = asciiFallback(filename);
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => {
    const code = c.charCodeAt(0).toString(16).toUpperCase();
    return `%${code.length === 1 ? '0' : ''}${code}`;
  });
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
