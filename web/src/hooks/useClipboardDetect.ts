import { useCallback, useEffect, useState } from 'react';

const YT_PATTERN = /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;

export function useClipboardDetect(enabled: boolean) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const dismiss = useCallback(() => setSuggestion(null), []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;

    let cancelled = false;
    const check = async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!cancelled && YT_PATTERN.test(text)) setSuggestion(text);
      } catch {
        /* permission denied — silently ignore */
      }
    };

    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  return { suggestion, dismiss };
}
