import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, JobView, Selection } from '../types/api';
import { createJob, cancelJob, ApiRequestError } from '../lib/api';

interface DownloadState {
  job: JobView | null;
  error: ApiError | null;
  submitting: boolean;
}

const TERMINAL = new Set<JobView['state']>(['completed', 'failed', 'expired']);

export function useDownloadJob() {
  const [state, setState] = useState<DownloadState>({ job: null, error: null, submitting: false });
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const subscribe = useCallback(
    (id: string) => {
      closeStream();
      const source = new EventSource(`/api/jobs/${encodeURIComponent(id)}/events`);
      sourceRef.current = source;
      source.addEventListener('state', (event) => {
        try {
          const job = JSON.parse((event as MessageEvent).data) as JobView;
          setState((prev) => ({ ...prev, job, error: job.error }));
          if (TERMINAL.has(job.state)) closeStream();
        } catch {
          /* ignore malformed frame */
        }
      });
    },
    [closeStream],
  );

  const start = useCallback(
    async (url: string, selection: Selection) => {
      setState({ job: null, error: null, submitting: true });
      try {
        const { job } = await createJob(url, selection);
        setState({ job, error: null, submitting: false });
        subscribe(job.id);
      } catch (e) {
        const error = e instanceof ApiRequestError ? e.apiError : { category: 'internal' as const, message: 'Failed to start.' };
        setState({ job: null, error, submitting: false });
      }
    },
    [subscribe],
  );

  const cancel = useCallback(() => {
    const id = state.job?.id;
    closeStream();
    if (id) void cancelJob(id);
    setState({ job: null, error: null, submitting: false });
  }, [state.job?.id, closeStream]);

  const reset = useCallback(() => {
    closeStream();
    setState({ job: null, error: null, submitting: false });
  }, [closeStream]);

  useEffect(() => () => closeStream(), [closeStream]);

  return { ...state, start, cancel, reset };
}
