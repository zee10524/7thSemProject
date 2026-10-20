export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  now?: () => number;
}

/**
 * Consecutive-failure circuit breaker. After `failureThreshold` failures it opens and fails fast for
 * `cooldownMs`; then it lets one trial call through (half-open) and closes again on success.
 */
export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;
  private readonly now: () => number;

  constructor(private readonly opts: BreakerOptions) {
    this.now = opts.now ?? Date.now;
  }

  snapshot(): { state: BreakerState; failures: number } {
    this.refresh();
    return { state: this.state, failures: this.failures };
  }

  /** True when a call may proceed. In half-open state only one trial call is allowed at a time. */
  tryAcquire(): boolean {
    this.refresh();
    if (this.state === 'closed') return true;
    if (this.state === 'half_open' && !this.trialInFlight) {
      this.trialInFlight = true;
      return true;
    }
    return false;
  }

  onSuccess(): void {
    this.state = 'closed';
    this.failures = 0;
    this.trialInFlight = false;
  }

  onFailure(): void {
    this.trialInFlight = false;
    if (this.state === 'half_open') {
      this.open();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) this.open();
  }

  private open(): void {
    this.state = 'open';
    this.openedAt = this.now();
  }

  private refresh(): void {
    if (this.state === 'open' && this.now() - this.openedAt >= this.opts.cooldownMs) {
      this.state = 'half_open';
      this.trialInFlight = false;
    }
  }
}
