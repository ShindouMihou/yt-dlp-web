export function computeTtlMs(
  sizeBytes: number,
  minMs: number,
  maxMs: number,
  msPerByte: number,
): number {
  const scaled = minMs + Math.max(0, sizeBytes) * msPerByte;
  return Math.min(maxMs, Math.max(minMs, scaled));
}
