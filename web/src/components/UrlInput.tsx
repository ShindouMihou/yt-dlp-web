import { useCallback, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, FormEvent } from 'react';
import { CloseIcon } from './icons';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  return (match ? match[0] : text).trim();
}

export function UrlInput({ value, onChange, onSubmit, onClear, disabled }: UrlInputProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed.length > 0) onSubmit(trimmed);
    },
    [value, onSubmit],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      const url = extractUrl(text);
      if (url.length > 0) {
        e.preventDefault();
        onChange(url);
        onSubmit(url);
      }
    },
    [onChange, onSubmit],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      setDragOver(false);
      const url = extractUrl(e.dataTransfer.getData('text'));
      if (url.length > 0) {
        onChange(url);
        onSubmit(url);
      }
    },
    [onChange, onSubmit],
  );

  return (
    <form
      onSubmit={submit}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      className={`flex items-center gap-2 rounded-2xl border bg-surface/80 p-2 backdrop-blur transition-colors ${
        dragOver ? 'border-accent' : 'border-border'
      }`}
    >
      <label htmlFor="url" className="sr-only">
        YouTube or YouTube Music link
      </label>
      <input
        id="url"
        ref={inputRef}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste a YouTube link"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-text placeholder:text-muted focus:outline-none disabled:opacity-60"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          aria-label="Clear"
          className="flex size-9 items-center justify-center rounded-lg text-muted hover:text-text"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        Go
      </button>
    </form>
  );
}
