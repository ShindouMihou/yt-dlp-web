import { useEffect, useState } from 'react';

export function useCountdown(expiresAt: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    expiresAt === null ? 0 : Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    if (expiresAt === null) return;
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}
