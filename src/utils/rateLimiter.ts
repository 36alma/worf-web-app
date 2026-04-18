/** Client-side rolling-window rate limiter for calendar API categories. */

export type RateLimitCategory = 'calendar_mutate' | 'calendar_get' | 'event_mutate' | 'event_get';

interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitStatus {
  category: RateLimitCategory;
  used: number;
  remaining: number;
  resetInMs: number;
}

const RULES: Record<RateLimitCategory, RateLimitRule> = {
  calendar_mutate: { limit: 35, windowMs: 5 * 60_000 },
  calendar_get: { limit: 90, windowMs: 2 * 60_000 },
  event_mutate: { limit: 50, windowMs: 5 * 60_000 },
  event_get: { limit: 120, windowMs: 2 * 60_000 }
};

export class ClientRateLimiter {
  private readonly buckets = new Map<RateLimitCategory, number[]>();

  private getWindowTimestamps(category: RateLimitCategory): number[] {
    const now = Date.now();
    const rule = RULES[category];
    const existing = this.buckets.get(category) ?? [];
    const filtered = existing.filter((ts) => now - ts <= rule.windowMs);
    this.buckets.set(category, filtered);
    return filtered;
  }

  getStatus(category: RateLimitCategory): RateLimitStatus {
    const rule = RULES[category];
    const timestamps = this.getWindowTimestamps(category);
    const oldest = timestamps[0];
    const resetInMs = oldest ? Math.max(0, rule.windowMs - (Date.now() - oldest)) : 0;
    return {
      category,
      used: timestamps.length,
      remaining: Math.max(0, rule.limit - timestamps.length),
      resetInMs
    };
  }

  canProceed(category: RateLimitCategory): boolean {
    return this.getStatus(category).remaining > 0;
  }

  record(category: RateLimitCategory): void {
    const timestamps = this.getWindowTimestamps(category);
    timestamps.push(Date.now());
    this.buckets.set(category, timestamps);
  }
}
