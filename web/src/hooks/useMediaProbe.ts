import { useCallback, useRef, useState } from 'react';
import type { ApiError, MediaMetadata } from '../types/api';
import { probeUrl, ApiRequestError } from '../lib/api';

interface ProbeState {
  loading: boolean;
  metadata: MediaMetadata | null;
  error: ApiError | null;
}

const idle: ProbeState = { loading: false, metadata: null, error: null };

export function useMediaProbe() {
  const [state, setState] = useState<ProbeState>(idle);
  const controllerRef = useRef<AbortController | null>(null);

  const probe = useCallback(async (url: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ loading: true, metadata: null, error: null });
    try {
      const { metadata } = await probeUrl(url, controller.signal);
      if (!controller.signal.aborted) setState({ loading: false, metadata, error: null });
    } catch (e) {
      if (controller.signal.aborted) return;
      const error =
        e instanceof ApiRequestError
          ? e.apiError
          : { category: 'internal' as const, message: 'Could not read that link.' };
      setState({ loading: false, metadata: null, error });
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(idle);
  }, []);

  return { ...state, probe, reset };
}
