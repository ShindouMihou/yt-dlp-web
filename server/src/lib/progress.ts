import type { ProgressStage } from '../types/api.ts';

export const DOWNLOAD_TEMPLATE =
  'download:DLP|v1|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s';

export const POSTPROCESSOR_TEMPLATE =
  'postprocess:PP|v1|%(progress.status)s|%(progress.postprocessor)s';

export interface DownloadProgress {
  type: 'download';
  status: string;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSec: number | null;
  etaSeconds: number | null;
}

export interface PostprocessProgress {
  type: 'postprocessor';
  status: string;
  postprocessor: string;
}

export type ParsedProgress = DownloadProgress | PostprocessProgress;

function num(field: string | undefined): number | null {
  if (field === undefined) return null;
  const trimmed = field.trim();
  if (trimmed === '' || trimmed === 'NA' || trimmed === 'None' || trimmed === 'null') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseProgressLine(line: string): ParsedProgress | null {
  const trimmed = line.trim();

  if (trimmed.startsWith('DLP|v1|')) {
    const parts = trimmed.split('|');
    if (parts.length < 8) return null;
    return {
      type: 'download',
      status: parts[2] ?? '',
      downloadedBytes: num(parts[3]),
      totalBytes: num(parts[4]) ?? num(parts[5]),
      speedBytesPerSec: num(parts[6]),
      etaSeconds: num(parts[7]),
    };
  }

  if (trimmed.startsWith('PP|v1|')) {
    const parts = trimmed.split('|');
    if (parts.length < 4) return null;
    return { type: 'postprocessor', status: parts[2] ?? '', postprocessor: parts[3] ?? '' };
  }

  return null;
}

export function stageForPostprocessor(name: string): ProgressStage {
  const normalized = name.toLowerCase();
  if (normalized.includes('merger')) return 'merging';
  if (normalized.includes('extractaudio') || normalized.includes('convert')) return 'converting';
  return 'converting';
}
