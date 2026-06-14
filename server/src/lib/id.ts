import { randomBytes, randomUUID } from 'node:crypto';

export function jobId(): string {
  return randomUUID();
}

export function downloadToken(): string {
  return randomBytes(24).toString('base64url');
}
