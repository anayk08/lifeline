// A small in-memory rate limiter (token bucket per caller), so one client can't run up Bedrock
// and Amazon Location costs. Fine for one server process; a deployed API should also use
// AppSync/WAF rate rules (see COMPLIANCE_TODO.md).

interface Bucket {
  tokens: number;
  updated: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /** `perMinute` requests per minute, with bursts up to `burst`. */
  constructor(
    private perMinute: number,
    private burst = perMinute,
  ) {}

  /** Returns 0 if the request may go ahead, otherwise the seconds to wait. */
  take(key: string, now = Date.now()): number {
    const refill = this.perMinute / 60_000;
    const b = this.buckets.get(key) ?? { tokens: this.burst, updated: now };
    b.tokens = Math.min(this.burst, b.tokens + (now - b.updated) * refill);
    b.updated = now;
    this.buckets.set(key, b);
    if (this.buckets.size > 10_000) this.prune(now);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - b.tokens) / refill / 1000);
  }

  private prune(now: number) {
    for (const [key, b] of this.buckets) if (now - b.updated > 10 * 60_000) this.buckets.delete(key);
  }
}
