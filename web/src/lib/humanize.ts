import type { ProgressStage } from '../types/api';

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds <= 0) return '';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatSpeed(bytesPerSec: number | null): string {
  const formatted = formatBytes(bytesPerSec);
  return formatted ? `${formatted}/s` : '';
}

export function naturalEta(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '';
  if (seconds < 60) return 'less than a minute left';
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) return 'about a minute left';
  if (minutes < 60) return `about ${minutes} minutes left`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'about an hour left' : `about ${hours} hours left`;
}

const STAGE_LABELS: Record<ProgressStage, string> = {
  preparing: 'Getting ready…',
  downloading: 'Downloading…',
  merging: 'Preparing your file…',
  converting: 'Converting…',
};

export function stageLabel(stage: ProgressStage): string {
  return STAGE_LABELS[stage];
}

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return 'expired';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
