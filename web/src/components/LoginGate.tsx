import { useState } from 'react';
import type { FormEvent } from 'react';
import { LockIcon } from './icons';
import { Button } from './ui/Button';

interface LoginGateProps {
  onLogin: (password: string) => Promise<void>;
}

export function LoginGate({ onLogin }: LoginGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length === 0) return;
    setBusy(true);
    setError(false);
    try {
      await onLogin(password);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
          <LockIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">This instance is protected</h2>
          <p className="text-xs text-muted">Enter the password to continue.</p>
        </div>
      </div>
      <input
        type="password"
        value={password}
        autoFocus
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        aria-label="Password"
        aria-invalid={error}
        className="min-h-11 rounded-xl border border-border bg-surface-2 px-4 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {error && (
        <p className="text-xs text-danger" role="alert">
          Incorrect password. Try again.
        </p>
      )}
      <Button type="submit" disabled={busy || password.length === 0}>
        {busy ? 'Checking…' : 'Unlock'}
      </Button>
    </form>
  );
}
