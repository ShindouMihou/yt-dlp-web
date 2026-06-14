import type {
  AppConfigResponse,
  ApiError,
  CreateJobResponse,
  ProbeResponse,
  Selection,
} from '../types/api';

export class ApiRequestError extends Error {
  constructor(public readonly apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiRequestError';
  }
}

const GENERIC: ApiError = { category: 'internal', message: 'Network error. Please try again.' };

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: ApiError };
    if (data.error && typeof data.error.category === 'string') return data.error;
  } catch {
    /* fall through */
  }
  return GENERIC;
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiRequestError(GENERIC);
  }
  if (!res.ok) throw new ApiRequestError(await parseError(res));
  return (await res.json()) as T;
}

export async function fetchConfig(): Promise<AppConfigResponse> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new ApiRequestError(GENERIC);
  return (await res.json()) as AppConfigResponse;
}

export async function login(password: string): Promise<void> {
  await postJson('/api/session', { password });
}

export function probeUrl(url: string, signal?: AbortSignal): Promise<ProbeResponse> {
  return postJson<ProbeResponse>('/api/probe', { url }, signal);
}

export function createJob(url: string, selection: Selection): Promise<CreateJobResponse> {
  return postJson<CreateJobResponse>('/api/jobs', { url, selection });
}

export async function cancelJob(id: string): Promise<void> {
  try {
    await fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  } catch {
    /* best-effort */
  }
}

export function fileUrl(token: string): string {
  return `/api/files/${encodeURIComponent(token)}`;
}
