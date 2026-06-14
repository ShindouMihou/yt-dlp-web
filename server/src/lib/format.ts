import { RESOLUTION_CAPS } from '../types/api.ts';
import type { Selection, FormatKind, ResolutionCap } from '../types/api.ts';

const VALID_KINDS = new Set<FormatKind>(['video', 'audio']);
const VALID_HEIGHTS = new Set<number>(RESOLUTION_CAPS);

export function parseSelection(input: unknown): Selection | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.kind !== 'string' || !VALID_KINDS.has(raw.kind as FormatKind)) return null;
  const kind = raw.kind as FormatKind;

  let maxHeight: ResolutionCap | undefined;
  if (raw.maxHeight !== undefined && raw.maxHeight !== null) {
    if (typeof raw.maxHeight !== 'number' || !VALID_HEIGHTS.has(raw.maxHeight)) return null;
    maxHeight = raw.maxHeight as ResolutionCap;
  }

  return maxHeight === undefined ? { kind } : { kind, maxHeight };
}

export interface FormatArgs {
  args: string[];
  expectedExt: string;
}

export function buildFormatArgs(selection: Selection): FormatArgs {
  if (selection.kind === 'audio') {
    return {
      args: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'],
      expectedExt: 'mp3',
    };
  }

  const sortKeys =
    selection.maxHeight !== undefined
      ? `res:${selection.maxHeight},ext:mp4:m4a,br`
      : `ext:mp4:m4a,res,br`;

  return {
    args: ['-f', 'bv*+ba/b', '-S', sortKeys, '--merge-output-format', 'mp4'],
    expectedExt: 'mp4',
  };
}
