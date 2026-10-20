import { LRUCache } from 'lru-cache';
import type { Redis } from 'ioredis';
import type { Logger } from './logger.js';

export interface CacheStore {
  readonly kind: 'memory' | 'redis';
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlS: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class MemoryCache implements CacheStore {
  readonly kind = 'memory' as const;
  private readonly lru = new LRUCache<string, { v: unknown }>({ max: 5000, ttlAutopurge: false });

  async get<T>(key: string): Promise<T | undefined> {
    return this.lru.get(key)?.v as T | undefined;
  }

  async set(key: string, value: unknown, ttlS: number): Promise<void> {
    this.lru.set(key, { v: value }, { ttl: ttlS * 1000 });
  }

  async del(key: string): Promise<void> {
    this.lru.delete(key);
  }
}

/** Redis-backed cache. A Redis failure is logged and treated as a miss: caching never breaks a request. */
export class RedisCache implements CacheStore {
  readonly kind = 'redis' as const;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly prefix = 'ls:cache:',
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(this.prefix + key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, key }, 'cache get failed');
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlS: number): Promise<void> {
    try {
      await this.redis.set(this.prefix + key, JSON.stringify(value), 'EX', ttlS);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, key }, 'cache set failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.prefix + key);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, key }, 'cache del failed');
    }
  }
}

/** Read-through cache with in-process single-flight, so a burst of misses makes one upstream call. */
export class Cached {
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly store: CacheStore) {}

  get kind(): CacheStore['kind'] {
    return this.store.kind;
  }

  async wrap<T>(key: string, ttlS: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.store.get<T>(key);
    if (hit !== undefined) return hit;
    const running = this.inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const p = load()
      .then(async (value) => {
        await this.store.set(key, value, ttlS);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  del(key: string): Promise<void> {
    return this.store.del(key);
  }
}
