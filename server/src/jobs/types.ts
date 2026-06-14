import type { ApiError, JobState, ProgressSnapshot, Selection, MediaMetadata } from '../types/api.ts';

export interface JobResult {
  token: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  expiresAt: number;
}

export interface Job {
  id: string;
  state: JobState;
  selection: Selection;
  metadata: MediaMetadata;
  progress: ProgressSnapshot;
  error: ApiError | null;
  result: JobResult | null;
  dir: string;
  abort: AbortController;
  createdAt: number;
  activeStreams: number;
  markedExpired: boolean;
}

export type JobListener = () => void;
