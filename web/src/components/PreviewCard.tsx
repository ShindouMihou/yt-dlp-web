import { forwardRef } from 'react';
import type { MediaMetadata } from '../types/api';
import { formatDuration } from '../lib/humanize';

interface PreviewCardProps {
  metadata: MediaMetadata;
}

export const PreviewCard = forwardRef<HTMLDivElement, PreviewCardProps>(({ metadata }, ref) => {
  const duration = formatDuration(metadata.durationSeconds);
  return (
    <div ref={ref} tabIndex={-1} className="flex gap-4 focus:outline-none">
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-40">
        {metadata.thumbnailUrl ? (
          <img
            src={metadata.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="size-full bg-surface-2" />
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
        {metadata.isLive && (
          <span className="absolute left-1.5 top-1.5 rounded bg-danger px-1.5 py-0.5 text-xs font-semibold uppercase text-white">
            Live
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-text">
          {metadata.title}
        </h2>
        {metadata.uploader && (
          <p className="mt-1 truncate text-sm text-muted">{metadata.uploader}</p>
        )}
      </div>
    </div>
  );
});

PreviewCard.displayName = 'PreviewCard';
