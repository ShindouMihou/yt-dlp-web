export type ErrorCategory =
  | 'unsupported'
  | 'unavailable'
  | 'restricted'
  | 'bot_wall'
  | 'too_large'
  | 'timeout'
  | 'busy'
  | 'internal';

export interface ApiError {
  category: ErrorCategory;
  message: string;
}

export type FormatKind = 'video' | 'audio';

export const RESOLUTION_CAPS = [2160, 1440, 1080, 720, 480, 360] as const;
export type ResolutionCap = (typeof RESOLUTION_CAPS)[number];

export interface Selection {
  kind: FormatKind;
  maxHeight?: ResolutionCap;
}

export interface MediaMetadata {
  id: string;
  title: string;
  uploader: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  availableHeights: number[];
  isLive: boolean;
}

export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'expired';

export type ProgressStage = 'preparing' | 'downloading' | 'merging' | 'converting';

export interface ProgressSnapshot {
  stage: ProgressStage;
  indeterminate: boolean;
  percent: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSec: number | null;
  etaSeconds: number | null;
  queuePosition: number | null;
}

export interface JobView {
  id: string;
  state: JobState;
  selection: Selection;
  metadata: MediaMetadata;
  progress: ProgressSnapshot;
  error: ApiError | null;
  result: {
    token: string;
    filename: string;
    sizeBytes: number;
    expiresAt: number;
  } | null;
}

export interface ProbeResponse {
  metadata: MediaMetadata;
}

export interface CreateJobResponse {
  job: JobView;
}

export interface AppConfigResponse {
  gateEnabled: boolean;
  authenticated: boolean;
  maxFileSizeBytes: number;
}
