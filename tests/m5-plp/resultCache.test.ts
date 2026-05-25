import resultCache, {
  createResultCache,
  TTL_MS,
} from '../../src/m5-plp/lib/resultCache';

describe('resultCache singleton', () => {
  beforeEach(() => {
    resultCache.clear();
  });

  test('returns null when no entry has been set', () => {
    expect(resultCache.get('sarah', 'before')).toBeNull();
  });

  test('isStale returns true for missing keys', () => {
    expect(resultCache.isStale('sarah', 'before')).toBe(true);
  });

  test('set + get round-trip', () => {
    resultCache.set('sarah', 'after', {
      products: [
        {
          product_id: 'P001',
          name: 'Sample',
          price: 10,
          currency: 'GBP',
        },
      ],
      cached_at: Date.now(),
    });
    const hit = resultCache.get('sarah', 'after');
    expect(hit).not.toBeNull();
    expect(hit!.products).toHaveLength(1);
    expect(resultCache.isStale('sarah', 'after')).toBe(false);
  });

  test('TTL constant is exactly 300 seconds', () => {
    expect(TTL_MS).toBe(300 * 1000);
  });

  test('entry older than TTL is reported stale', () => {
    resultCache.set('alex', 'before', {
      products: [],
      cached_at: Date.now() - (TTL_MS + 1000),
    });
    expect(resultCache.isStale('alex', 'before')).toBe(true);
  });

  test('loadFromFile returns a non-empty product list on in-memory miss', () => {
    // No prior set() call — simulates the cache miss scenario where the fetch
    // chain falls through to the file-cache fallback.
    expect(resultCache.get('guest', 'before')).toBeNull();
    const file = resultCache.loadFromFile('guest', 'before');
    expect(file.products.length).toBeGreaterThan(0);
    expect(file.cached_at).toBeGreaterThan(0);
  });

  test('loadFromFile provides distinct After-state products for Sarah (gift bias)', () => {
    const after = resultCache.loadFromFile('sarah', 'after');
    expect(after.products.length).toBeGreaterThan(0);
    // At least one of the top 3 should be gift_eligible in the After state.
    const top3 = after.products.slice(0, 3);
    expect(top3.some((p) => (p as any).gift_eligible === true)).toBe(true);
  });
});

describe('createResultCache (isolated instance)', () => {
  test('isolated instances do not share state', () => {
    const a = createResultCache();
    const b = createResultCache();
    a.set('guest', 'before', { products: [], cached_at: Date.now() });
    expect(a.get('guest', 'before')).not.toBeNull();
    expect(b.get('guest', 'before')).toBeNull();
  });
});
