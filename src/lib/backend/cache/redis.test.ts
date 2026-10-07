import { logError } from '@/lib/backend/logger';
import { RedisAdapter } from './redis';

vi.mock('@/lib/backend/logger', () => ({
  logError: vi.fn(),
}));

function createClient() {
  return {
    get: vi.fn<(key: string) => Promise<string | null>>(),
    set: vi.fn<
      (key: string, value: string, ex: 'EX', seconds: number) => Promise<unknown>
    >(),
    del: vi.fn<(...keys: string[]) => Promise<unknown>>(),
    scan: vi.fn<
      (
        cursor: string,
        matchArg: 'MATCH',
        pattern: string,
        countArg: 'COUNT',
        count: number,
      ) => Promise<[string, string[]]>
    >(),
    quit: vi.fn<() => Promise<unknown>>(),
  };
}

type FakeClient = ReturnType<typeof createClient>;

function installClient(adapter: RedisAdapter, client: FakeClient) {
  (adapter as unknown as { client: FakeClient | null }).client = client;
}

function installedClient(adapter: RedisAdapter): FakeClient | null {
  return (adapter as unknown as { client: FakeClient | null }).client;
}

describe('RedisAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('parses cached JSON and returns null for a cache miss', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      installClient(adapter, client);

      client.get
        .mockResolvedValueOnce(JSON.stringify({ id: 'commitment-1' }))
        .mockResolvedValueOnce(null);

      await expect(adapter.get('commitment:1')).resolves.toEqual({
        id: 'commitment-1',
      });
      await expect(adapter.get('commitment:missing')).resolves.toBeNull();

      expect(client.get).toHaveBeenNthCalledWith(1, 'commitment:1');
      expect(client.get).toHaveBeenNthCalledWith(2, 'commitment:missing');
    });

    it('fails open and logs cache read errors', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      const error = new Error('redis read failed');
      installClient(adapter, client);
      client.get.mockRejectedValue(error);

      await expect(adapter.get('commitment:1')).resolves.toBeNull();

      expect(logError).toHaveBeenCalledWith(
        undefined,
        '[RedisAdapter] get failed',
        error,
        { key: 'commitment:1' },
      );
    });
  });

  describe('set', () => {
    it('serializes values and preserves the requested TTL', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      installClient(adapter, client);
      client.set.mockResolvedValue('OK');

      await adapter.set('commitment:1', { status: 'active' }, 90);

      expect(client.set).toHaveBeenCalledWith(
        'commitment:1',
        JSON.stringify({ status: 'active' }),
        'EX',
        90,
      );
    });

    it('fails open and logs cache write errors', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      const error = new Error('redis write failed');
      installClient(adapter, client);
      client.set.mockRejectedValue(error);

      await expect(
        adapter.set('commitment:1', { status: 'active' }, 90),
      ).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledWith(
        undefined,
        '[RedisAdapter] set failed',
        error,
        { key: 'commitment:1' },
      );
    });
  });

  describe('delete', () => {
    it('deletes the requested cache key', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      installClient(adapter, client);
      client.del.mockResolvedValue(1);

      await adapter.delete('commitment:1');

      expect(client.del).toHaveBeenCalledWith('commitment:1');
    });

    it('fails open and logs delete errors', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      const error = new Error('redis delete failed');
      installClient(adapter, client);
      client.del.mockRejectedValue(error);

      await expect(adapter.delete('commitment:1')).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledWith(
        undefined,
        '[RedisAdapter] delete failed',
        error,
        { key: 'commitment:1' },
      );
    });
  });

  describe('invalidate', () => {
    it('scans every cursor page and deletes matching keys', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      installClient(adapter, client);
      client.scan
        .mockResolvedValueOnce(['7', ['commitment:1', 'commitment:2']])
        .mockResolvedValueOnce(['0', ['commitment:3']]);
      client.del.mockResolvedValue(1);

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
      expect(client.del).toHaveBeenNthCalledWith(
        1,
        'commitment:1',
        'commitment:2',
      );
      expect(client.del).toHaveBeenNthCalledWith(2, 'commitment:3');
    });

    it('fails open and logs scan errors', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      const error = new Error('redis scan failed');
      installClient(adapter, client);
      client.scan.mockRejectedValue(error);

      await expect(adapter.invalidate('commitment:')).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledWith(
        undefined,
        '[RedisAdapter] invalidate failed',
        error,
        { prefix: 'commitment:' },
      );
    });
  });

  describe('disconnect', () => {
    it('quits the client and clears the cached connection', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      installClient(adapter, client);
      client.quit.mockResolvedValue('OK');

      await adapter.disconnect();

      expect(client.quit).toHaveBeenCalledOnce();
      expect(installedClient(adapter)).toBeNull();
    });

    it('fails open, logs quit errors, and clears the cached client', async () => {
      const adapter = new RedisAdapter('redis://test');
      const client = createClient();
      const error = new Error('redis quit failed');
      installClient(adapter, client);
      client.quit.mockRejectedValue(error);

      await expect(adapter.disconnect()).resolves.toBeUndefined();

      expect(client.quit).toHaveBeenCalledOnce();
      expect(installedClient(adapter)).toBeNull();
      expect(logError).toHaveBeenCalledWith(
        undefined,
        '[RedisAdapter] disconnect failed',
        error,
      );
    });
  });
});
