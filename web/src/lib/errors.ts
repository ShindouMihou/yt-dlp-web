import type { ApiError, ErrorCategory } from '../types/api';

interface ErrorCopy {
  title: string;
  body: string;
  canRetry: boolean;
}

const COPY: Record<ErrorCategory, ErrorCopy> = {
  unsupported: {
    title: 'That link won’t work',
    body: 'Paste a single YouTube or YouTube Music video link — not a playlist, channel, or other site.',
    canRetry: false,
  },
  unavailable: {
    title: 'Video not available',
    body: 'This video may be private, deleted, or never existed. Double-check the link.',
    canRetry: true,
  },
  restricted: {
    title: 'YouTube is blocking this one',
    body: 'It’s age- or region-restricted. There’s nothing this page can do about that.',
    canRetry: false,
  },
  bot_wall: {
    title: 'YouTube wants us to prove we’re human',
    body: 'This download is temporarily blocked. Ask whoever set up this site to help — they’ll know what to do.',
    canRetry: true,
  },
  too_large: {
    title: 'That file is too big',
    body: 'This download is larger than this server allows, or the server is low on space right now.',
    canRetry: false,
  },
  timeout: {
    title: 'This took too long',
    body: 'The download was stopped because it ran too long. Try a shorter or smaller video.',
    canRetry: true,
  },
  busy: {
    title: 'The server is busy',
    body: 'Too many requests at once. Give it a moment and try again.',
    canRetry: true,
  },
  internal: {
    title: 'Something went wrong',
    body: 'An unexpected error happened. Please try again.',
    canRetry: true,
  },
};

export function errorCopy(error: ApiError): ErrorCopy {
  return COPY[error.category] ?? COPY.internal;
}
