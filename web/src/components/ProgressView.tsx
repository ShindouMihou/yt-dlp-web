import type { JobView } from '../types/api';
import { stageLabel, naturalEta, formatSpeed } from '../lib/humanize';
import { Button } from './ui/Button';

interface ProgressViewProps {
  job: JobView;
  onCancel: () => void;
}

export function ProgressView({ job, onCancel }: ProgressViewProps) {
  const { progress, state } = job;
  const queued = state === 'queued';
  const percent = progress.percent;
  const showDeterminate = !queued && percent !== null && !progress.indeterminate;

  const headline = queued
    ? progress.queuePosition && progress.queuePosition > 1
      ? `Waiting in queue — ${progress.queuePosition - 1} ahead of you`
      : 'Waiting for a free slot…'
    : stageLabel(progress.stage);

  const detail = !queued
    ? [formatSpeed(progress.speedBytesPerSec), naturalEta(progress.etaSeconds)]
        .filter(Boolean)
        .join(' · ')
    : 'The server is busy — your download will start shortly.';

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-text">{headline}</span>
        {showDeterminate && (
          <span className="text-sm font-semibold tabular-nums text-accent">
            {Math.round(percent)}%
          </span>
        )}
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
        {showDeterminate ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(2, percent)}%` }}
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        ) : (
          <div className="indeterminate-bar absolute inset-0" role="progressbar" aria-valuetext={headline} />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="min-h-5 text-xs text-muted">{detail}</span>
        <Button variant="subtle" onClick={onCancel} className="px-2 text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}
