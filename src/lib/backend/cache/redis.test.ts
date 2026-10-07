import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logError } from '@/lib/backend/logger';
import { RedisAdapter } from './redis';

vi.mock('@/lib/backend/logger', () => ({
  logError: vi.fn(),
}));

function makeClient() {
  return {
    get: vi.fn(async (_key: string): Promise<string | null> => null),
    set: vi.fn(
      async (
        _key: string,
        _value: string,
        _ex: 'EX',
        _seconds: number,
      ): Promise<void> => undefined,
    ),
    del: vi.fn(async (..._keys: string[]): Promise<number> => 0),
    scan: vi.fn(
      async (
        _cursor: string,
        _matchArg: 'MATCH',
        _pattern: string,
        _countArg: 'COUNT',
        _count: number,
      ): Promise<[string, string[]]> => ['0', []],
    ),
    quit: vi.fn(async (): Promise<void> => undefined),
  };
}

describe('RedisAdapter', () => {
  const logErrorMock = vi.mocked(logError);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the Redis client lazily and parses cached JSON', async () => {
    const client = makeClient();
    client.get.mockResolvedValueOnce(JSON.stringify({ status: 'cached' }));
    const factory = vi.fn((_url: string) => client);
    const adapter = new RedisAdapter('redis://cache.test:6379', factory);

    expect(factory).not.toHaveBeenCalled();
    await expect(adapter.get<{ status: string }>('commitment:1')).resolves.toEqual({
      status: 'cached',
    });
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith('redis://cache.test:6379');
    expect(client.get).toHaveBeenCalledWith('commitment:1');
  });

  it('fails open when get throws', async () => {
    const client = makeClient();
    const error = new Error('redis unavailable');
    client.get.mockRejectedValueOnce(error);
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await expect(adapter.get('commitment:1')).resolves.toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith(
      undefined,
      '[RedisAdapter] get failed',
      error,
      { key: 'commitment:1' },
    );
  });

  it('serializes values and applies the requested TTL on set', async () => {
    const client = makeClient();
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await adapter.set('commitment:1', { amount: 42 }, 90);

    expect(client.set).toHaveBeenCalledWith(
      'commitment:1',
      JSON.stringify({ amount: 42 }),
      'EX',
      90,
    );
  });

  it('fails open when set throws', async () => {
    const client = makeClient();
    const error = new Error('write failed');
    client.set.mockRejectedValueOnce(error);
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await expect(adapter.set('commitment:1', { amount: 42 }, 90)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith(
      undefined,
      '[RedisAdapter] set failed',
      error,
      { key: 'commitment:1' },
    );
  });

  it('deletes the requested cache key', async () => {
    const client = makeClient();
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await adapter.delete('commitment:1');

    expect(client.del).toHaveBeenCalledWith('commitment:1');
  });

  it('fails open when delete throws', async () => {
    const client = makeClient();
    const error = new Error('delete failed');
    client.del.mockRejectedValueOnce(error);
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await expect(adapter.delete('commitment:1')).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith(
      undefined,
      '[RedisAdapter] delete failed',
      error,
      { key: 'commitment:1' },
    );
  });

  it('scans every cursor page and deletes matching keys in batches', async () => {
    const client = makeClient();
    client.scan
      .mockResolvedValueOnce(['7', ['commitment:1', 'commitment:2']])
      .mockResolvedValueOnce(['0', ['commitment:3']]);
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await adapter.invalidate('commitment:');

    expect(client.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'commitment:*',
      'COUNT',
      100,
    );
    expect(client.scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'commitment:*',
      'COUNT',
      100,
    );
    expect(client.del).toHaveBeenNthCalledWith(1, 'commitment:1', 'commitment:2');
    expect(client.del).toHaveBeenNthCalledWith(2, 'commitment:3');
  });

  it('fails open when invalidate throws', async () => {
    const client = makeClient();
    const error = new Error('scan failed');
    client.scan.mockRejectedValueOnce(error);
    const adapter = new RedisAdapter('redis://cache.test', () => client);

    await expect(adapter.invalidate('commitment:')).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith(
      undefined,
      '[RedisAdapter] invalidate failed',
      error,
      { prefix: 'commitment:' },
    );
  });

  it('quits and clears the cached client on disconnect', async () => {
    const client = makeClient();
    const factory = vi.fn((_url: string) => client);
    const adapter = new RedisAdapter('redis://cache.test', factory);
    await adapter.set('commitment:1', 'value', 30);

    await adapter.disconnect();
    await adapter.get('commitment:1');

    expect(client.quit).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('fails open on quit errors and still permits a fresh client', async () => {
    const first = makeClient();
    const second = makeClient();
    const error = new Error('quit failed');
    first.quit.mockRejectedValueOnce(error);
    second.get.mockResolvedValueOnce(JSON.stringify({ fresh: true }));
    const factory = vi
      .fn((_url: string) => first)
      .mockImplementationOnce((_url: string) => first)
      .mockImplementationOnce((_url: string) => second);
    const adapter = new RedisAdapter('redis://cache.test', factory);
    await adapter.set('commitment:1', 'value', 30);

    await expect(adapter.disconnect()).resolves.toBeUndefined();
    await expect(adapter.get('commitment:1')).resolves.toEqual({ fresh: true });

    expect(logErrorMock).toHaveBeenCalledWith(
      undefined,
      '[RedisAdapter] disconnect failed',
      error,
    );
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
