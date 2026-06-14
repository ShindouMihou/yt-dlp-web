import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RESOLUTION_CAPS } from '../types/api';
import type { Selection, FormatKind, ResolutionCap } from '../types/api';
import { VideoIcon, MusicIcon, ChevronIcon } from './icons';

interface FormatPickerProps {
  selection: Selection;
  availableHeights: number[];
  onChange: (selection: Selection) => void;
  reducedMotion: boolean;
}

interface PresetButtonProps {
  active: boolean;
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function PresetButton({ active, label, hint, icon, onClick }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active ? 'border-accent bg-accent/10' : 'border-border bg-surface-2 hover:border-muted'
      }`}
    >
      <span className={`flex size-9 items-center justify-center rounded-lg ${active ? 'text-accent' : 'text-muted'}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

export function FormatPicker({ selection, availableHeights, onChange, reducedMotion }: FormatPickerProps) {
  const [open, setOpen] = useState(false);
  const maxAvailable = availableHeights.length > 0 ? Math.max(...availableHeights) : Infinity;

  const setKind = (kind: FormatKind) => onChange({ ...selection, kind });
  const setHeight = (maxHeight: ResolutionCap | undefined) =>
    onChange(maxHeight === undefined ? { kind: selection.kind } : { kind: selection.kind, maxHeight });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <PresetButton
          active={selection.kind === 'video'}
          label="Video"
          hint="Best quality MP4"
          icon={<VideoIcon className="size-5" />}
          onClick={() => setKind('video')}
        />
        <PresetButton
          active={selection.kind === 'audio'}
          label="Audio"
          hint="MP3 for music"
          icon={<MusicIcon className="size-5" />}
          onClick={() => setKind('audio')}
        />
      </div>

      {selection.kind === 'video' && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text"
          >
            Advanced
            <ChevronIcon className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  <ResolutionChip
                    active={selection.maxHeight === undefined}
                    disabled={false}
                    onClick={() => setHeight(undefined)}
                  >
                    Best
                  </ResolutionChip>
                  {RESOLUTION_CAPS.map((h) => (
                    <ResolutionChip
                      key={h}
                      active={selection.maxHeight === h}
                      disabled={h > maxAvailable}
                      onClick={() => setHeight(h)}
                    >
                      {h}p
                    </ResolutionChip>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

interface ResolutionChipProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ResolutionChip({ active, disabled, onClick, children }: ResolutionChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors ${
        active
          ? 'border-accent bg-accent/10 text-text'
          : 'border-border bg-surface-2 text-muted hover:border-muted'
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {children}
    </button>
  );
}
