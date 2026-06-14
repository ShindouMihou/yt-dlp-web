import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Selection } from './types/api';
import { useConfig } from './hooks/useConfig';
import { useMediaProbe } from './hooks/useMediaProbe';
import { useDownloadJob } from './hooks/useDownloadJob';
import { useClipboardDetect } from './hooks/useClipboardDetect';
import { UrlInput } from './components/UrlInput';
import { PreviewCard } from './components/PreviewCard';
import { PreviewSkeleton } from './components/PreviewSkeleton';
import { FormatPicker } from './components/FormatPicker';
import { ProgressView } from './components/ProgressView';
import { ResultCard } from './components/ResultCard';
import { ErrorState } from './components/ErrorState';
import { LoginGate } from './components/LoginGate';
import { Button } from './components/ui/Button';
import { DownloadIcon } from './components/icons';

type Phase = 'idle' | 'probing' | 'preview' | 'working' | 'done' | 'error';

export function App() {
  const { loading, config, authenticated, login } = useConfig();
  const probe = useMediaProbe();
  const job = useDownloadJob();
  const reducedMotion = useReducedMotion() ?? false;

  const [url, setUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [selection, setSelection] = useState<Selection>({ kind: 'video' });

  const jobState = job.job?.state;
  const phase: Phase = useMemo(() => {
    if (job.error || probe.error) return 'error';
    if (jobState === 'completed') return 'done';
    if (job.submitting || jobState === 'queued' || jobState === 'running') return 'working';
    if (jobState === 'failed' || jobState === 'expired') return 'error';
    if (probe.loading) return 'probing';
    if (probe.metadata) return 'preview';
    return 'idle';
  }, [job.error, job.submitting, jobState, probe.error, probe.loading, probe.metadata]);

  const clipboardEnabled = phase === 'idle' && authenticated && url.length === 0;
  const { suggestion, dismiss } = useClipboardDetect(clipboardEnabled);

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== 'idle' && cardRef.current) cardRef.current.focus();
  }, [phase]);

  const submitUrl = useCallback(
    (value: string) => {
      setActiveUrl(value);
      void probe.probe(value);
    },
    [probe],
  );

  const startDownload = useCallback(() => {
    void job.start(activeUrl, selection);
  }, [job, activeUrl, selection]);

  const retry = useCallback(() => {
    if (job.error || jobState === 'failed') {
      void job.start(activeUrl, selection);
    } else {
      job.reset();
      void probe.probe(activeUrl);
    }
  }, [job, jobState, activeUrl, selection, probe]);

  const reset = useCallback(() => {
    job.reset();
    probe.reset();
    setUrl('');
    setActiveUrl('');
  }, [job, probe]);

  const useSuggestion = useCallback(() => {
    if (!suggestion) return;
    setUrl(suggestion);
    submitUrl(suggestion);
    dismiss();
  }, [suggestion, submitUrl, dismiss]);

  const activeError = job.error ?? probe.error;

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="size-8 rounded-full border-2 border-border border-t-accent motion-safe:animate-spin" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          ytdl4<span className="text-accent">.me</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Paste a YouTube link. Get the file.</p>
      </header>

      {config?.gateEnabled && !authenticated ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface/70 p-6 backdrop-blur">
          <LoginGate onLogin={login} />
        </section>
      ) : (
        <>
          <UrlInput
            value={url}
            onChange={setUrl}
            onSubmit={submitUrl}
            onClear={reset}
            disabled={phase === 'working'}
          />

          <AnimatePresence>
            {suggestion && phase === 'idle' && (
              <motion.button
                type="button"
                onClick={useSuggestion}
                initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 w-full truncate rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-left text-sm text-text"
              >
                <span className="text-accent">Found a link</span> — tap to download it
              </motion.button>
            )}
          </AnimatePresence>

          {phase === 'idle' && !suggestion && (
            <p className="mt-6 text-center text-xs text-muted">
              Works with youtube.com, youtu.be and YouTube Music links.
            </p>
          )}

          <AnimatePresence mode="wait">
            {phase !== 'idle' && (
              <motion.section
                key={phase}
                ref={cardRef}
                tabIndex={-1}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface/70 p-5 backdrop-blur focus:outline-none"
              >
                {phase === 'probing' && <PreviewSkeleton />}

                {phase === 'preview' && probe.metadata && (
                  <div className="flex flex-col gap-5">
                    <PreviewCard metadata={probe.metadata} />
                    <FormatPicker
                      selection={selection}
                      availableHeights={probe.metadata.availableHeights}
                      onChange={setSelection}
                      reducedMotion={reducedMotion}
                    />
                    <Button onClick={startDownload} className="w-full">
                      <DownloadIcon className="size-5" />
                      Download
                    </Button>
                  </div>
                )}

                {phase === 'working' && job.job && (
                  <ProgressView job={job.job} onCancel={reset} />
                )}

                {phase === 'working' && !job.job && (
                  <div className="flex flex-col gap-4" aria-live="polite">
                    <span className="text-sm font-medium text-text">Starting…</span>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="indeterminate-bar absolute inset-0" role="progressbar" />
                    </div>
                  </div>
                )}

                {phase === 'done' && job.job && <ResultCard job={job.job} onRestart={reset} />}

                {phase === 'error' && activeError && (
                  <ErrorState error={activeError} onRetry={retry} onReset={reset} />
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </>
      )}

      <footer className="mt-auto pt-10 text-center text-xs text-muted/70">
        Files are deleted automatically after 30–60 minutes.
      </footer>
    </main>
  );
}
