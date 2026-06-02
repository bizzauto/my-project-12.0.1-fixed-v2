import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory API response cache for read-heavy endpoints.
 * 
 * Features:
 * - TTL-based expiration
 * - Business-scoped (prevents cross-tenant data leaks)
 * - Cache invalidation on mutation requests
 * - Max 500 entries to prevent memory leaks
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
  key: string;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;

// Evict oldest entries when cache is full
function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    // First remove expired entries
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
    // If still over limit, remove oldest
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
}

/**
 * Middleware factory: cache GET responses for a configurable TTL.
 * 
 * Usage:
 *   router.get('/', authenticate, cacheResponse(60), handler); // cache 60 seconds
 * 
 * The cache is scoped by:
 * - Business ID (from req.user.businessId)
 * - Full URL (path + query string)
 * - User ID (prevents cross-user data leaks within same business)
 */
export function cacheResponse(ttlSeconds: number = 30) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key from business + user + URL
    const businessId = req.user?.businessId || 'anon';
    const userId = req.user?.id || 'anon';
    const url = req.originalUrl || req.url;
    const cacheKey = `${businessId}:${userId}:${url}`;

    // Check cache
    const entry = cache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      // Cache hit — send cached response
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', Math.ceil((entry.expiresAt - Date.now()) / 1000).toString());
      res.json(entry.data);
      return;
    }

    // Cache miss — intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        evictIfNeeded();
        cache.set(cacheKey, {
          data: body,
          expiresAt: Date.now() + ttlSeconds * 1000,
          key: cacheKey,
        });
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache entries for a specific business.
 * Call this after mutations (POST/PUT/DELETE) to ensure stale data isn't served.
 */
export function invalidateCache(businessId?: string): void {
  if (!businessId) {
    // Clear entire cache
    cache.clear();
    return;
  }

  // Clear only entries for this business
  const prefix = `${businessId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Cache stats for monitoring endpoint
 */
export function getCacheStats(): { size: number; hitRate: string } {
  return {
    size: cache.size,
    hitRate: 'N/A (per-request tracking)',
  };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

import { AuthRequest } from './auth.js';
