import { useCallback, useRef, useState } from 'react';
import type { JobView } from '../types/api';
import { fileUrl } from '../lib/api';
import { formatBytes, formatCountdown } from '../lib/humanize';
import { useCountdown } from '../hooks/useCountdown';
import { Button } from './ui/Button';
import { DownloadIcon, CheckIcon } from './icons';

interface ResultCardProps {
  job: JobView;
  onRestart: () => void;
}

function urgencyColor(msRemaining: number): string {
  if (msRemaining <= 2 * 60_000) return 'text-danger';
  if (msRemaining <= 10 * 60_000) return 'text-warning';
  return 'text-muted';
}

export function ResultCard({ job, onRestart }: ResultCardProps) {
  const result = job.result;
  const remaining = useCountdown(result?.expiresAt ?? null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDownload = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }, []);

  if (!result) return null;
  const expired = remaining <= 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text" title={result.filename}>
            {result.filename}
          </p>
          <p className="text-xs text-muted">{formatBytes(result.sizeBytes)} · ready to save</p>
        </div>
      </div>

      {expired ? (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          This file has expired and was removed from the server. Start again to re-create it.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <a
            href={fileUrl(result.token)}
            download={result.filename}
            onClick={onDownload}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,77,61,0.6)] transition-colors hover:bg-accent-soft"
          >
            {saved ? <CheckIcon className="size-5" /> : <DownloadIcon className="size-5" />}
            {saved ? 'Saved — check your downloads' : 'Download'}
          </a>
          <p className="text-center text-xs">
            <span className="text-muted">Expires in </span>
            <span className={`font-semibold tabular-nums ${urgencyColor(remaining)}`}>
              {formatCountdown(remaining)}
            </span>
          </p>
        </div>
      )}

      <Button variant="ghost" onClick={onRestart} className="w-full">
        Download another
      </Button>
    </div>
  );
}
