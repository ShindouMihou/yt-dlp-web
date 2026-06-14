interface Window {
  count: number;
  resetAt: number;
}

export class SlidingWindowLimiter {
  private readonly perKey = new Map<string, Window>();
  private global: Window = { count: 0, resetAt: 0 };
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly globalLimit: number;

  constructor(limit: number, windowMs: number, globalLimit: number) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.globalLimit = globalLimit;
  }

  check(key: string): boolean {
    const now = Date.now();

    if (now >= this.global.resetAt) this.global = { count: 0, resetAt: now + this.windowMs };
    if (this.global.count >= this.globalLimit) return false;

    let win = this.perKey.get(key);
    if (!win || now >= win.resetAt) {
      win = { count: 0, resetAt: now + this.windowMs };
      this.perKey.set(key, win);
    }
    if (win.count >= this.limit) return false;

    win.count += 1;
    this.global.count += 1;
    if (this.perKey.size > 5000) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, win] of this.perKey) {
      if (now >= win.resetAt) this.perKey.delete(key);
    }
  }
}
