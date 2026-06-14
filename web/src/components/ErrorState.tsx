import type { ApiError } from '../types/api';
import { errorCopy } from '../lib/errors';
import { AlertIcon } from './icons';
import { Button } from './ui/Button';

interface ErrorStateProps {
  error: ApiError;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorState({ error, onRetry, onReset }: ErrorStateProps) {
  const copy = errorCopy(error);
  return (
    <div className="flex flex-col gap-4" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
          <AlertIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">{copy.body}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {copy.canRetry && (
          <Button variant="primary" onClick={onRetry} className="flex-1">
            Try again
          </Button>
        )}
        <Button variant="ghost" onClick={onReset} className={copy.canRetry ? '' : 'flex-1'}>
          Start over
        </Button>
      </div>
    </div>
  );
}
