import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/backend/auth', () => ({
  verifySessionToken: vi.fn(),
  AUTH_COOKIE_NAME: 'cl_auth_session',
}));

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

import { checkRateLimit } from '@/lib/backend/rateLimit';
import { verifySessionToken } from '@/lib/backend/auth';
import {
  getUserCommitmentsFromChain,
  type ChainCommitment,
} from '@/lib/backend/services/contracts';
import { GET } from './route';

// Valid Stellar address format (56 chars starting with 'G')
const VALID_ADDRESS_A = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
const VALID_ADDRESS_B = 'GOTHERGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX';

const makeRequest = (
  searchParams: Record<string, string> = {},
  headers: Record<string, string> = {},
) => {
  const params = new URLSearchParams(searchParams);
  return new NextRequest(`http://localhost:3000/api/commitments/export?${params.toString()}`, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  });
};

describe('GET /api/commitments/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  it('returns 401 when the bearer token is missing', async () => {
    const res = await GET(makeRequest({ ownerAddress: VALID_ADDRESS_A }), { params: {} });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('uses the signed HttpOnly cookie for browser CSV export and still fences wrong-wallet requests', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_A });
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

    const cookie = { cookie: 'cl_auth_session=signed-browser-session' };
    const response = await GET(
      makeRequest({ ownerAddress: VALID_ADDRESS_A, dateRange: '7d', format: 'csv' }, cookie),
      { params: {} },
    );
    expect(response.status).toBe(200);
    expect(verifySessionToken).toHaveBeenCalledWith('signed-browser-session');

    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_B });
    const forbidden = await GET(makeRequest({ ownerAddress: VALID_ADDRESS_A }, cookie), {
      params: {},
    });
    expect(forbidden.status).toBe(403);
  });

  it('returns 403 when the session wallet does not match the requested ownerAddress', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_B });

    const res = await GET(
      makeRequest({ ownerAddress: VALID_ADDRESS_A }, { authorization: 'Bearer valid-token' }),
      { params: {} },
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('streams a CSV export with Excel-safe escaping for formula-like values', async () => {
    const ownerAddress = VALID_ADDRESS_A;
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: ownerAddress });

    const mockCommitment: ChainCommitment = {
      id: 'cmt-1',
      ownerAddress,
      asset: '=cmd|whoami',
      amount: '100',
      status: 'ACTIVE',
      complianceScore: 95,
      currentValue: '110',
      feeEarned: '0',
      violationCount: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      expiresAt: '2025-01-01T00:00:00.000Z',
    };

    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([mockCommitment]);

    const res = await GET(makeRequest({ ownerAddress }, { authorization: 'Bearer valid-token' }), {
      params: {},
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="commitments.csv"',
    );

    const csv = await res.text();
    expect(csv).toContain('Commitment ID');
    expect(csv).toContain("'=cmd|whoami");
  });

  it('returns 400 for an invalid ownerAddress format', async () => {
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_A });

    const res = await GET(
      makeRequest({ ownerAddress: 'not-a-valid-address' }, { authorization: 'Bearer valid-token' }),
      { params: {} },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('falls back to all dates when the requested range is unsupported', async () => {
    const ownerAddress = VALID_ADDRESS_A;
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: ownerAddress });
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

    const res = await GET(
      makeRequest({ ownerAddress, dateRange: 'nonsense' }, { authorization: 'Bearer valid-token' }),
      { params: {} },
    );

    expect(res.status).toBe(200);
    expect(getUserCommitmentsFromChain).toHaveBeenCalledWith(ownerAddress);
  });

  it('prevents duplicate submissions with idempotency-key', async () => {
    const ownerAddress = VALID_ADDRESS_A;
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: ownerAddress });
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

    const key = 'export-idem-1';
    const req1 = makeRequest(
      { ownerAddress },
      { authorization: 'Bearer valid-token', 'idempotency-key': key },
    );
    const res1 = await GET(req1, { params: {} });
    expect(res1.status).toBe(200);

    // Replay with same key should return cached response without re-fetching
    const req2 = makeRequest(
      { ownerAddress },
      { authorization: 'Bearer valid-token', 'idempotency-key': key },
    );
    const res2 = await GET(req2, { params: {} });
    expect(res2.status).toBe(200);

    // Should only fetch once (on first request)
    expect(getUserCommitmentsFromChain).toHaveBeenCalledTimes(1);
  });

  it('scopes idempotency replay by normalized export intent', async () => {
    const ownerAddress = VALID_ADDRESS_A;
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: ownerAddress });
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

    const key = 'export-idem-date-range';
    const headers = { authorization: 'Bearer valid-token', 'idempotency-key': key };

    const sevenDays = await GET(
      makeRequest({ ownerAddress, dateRange: '7d', format: 'csv' }, headers),
      { params: {} },
    );
    expect(sevenDays.status).toBe(200);

    const thirtyDays = await GET(
      makeRequest({ ownerAddress, dateRange: '30d', format: 'csv' }, headers),
      { params: {} },
    );
    expect(thirtyDays.status).toBe(200);

    // Same caller key with a different filter is a different export operation.
    expect(getUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
  });

  it('scopes idempotency key by wallet address', async () => {
    vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);

    const key = 'export-idem-shared';
    const req1 = makeRequest(
      { ownerAddress: VALID_ADDRESS_A },
      { authorization: 'Bearer valid-token-a', 'idempotency-key': key },
    );
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_A });
    const res1 = await GET(req1, { params: {} });
    expect(res1.status).toBe(200);

    // Wallet B uses same key but should get a new operation, not A's cached result
    const req2 = makeRequest(
      { ownerAddress: VALID_ADDRESS_B },
      { authorization: 'Bearer valid-token-b', 'idempotency-key': key },
    );
    vi.mocked(verifySessionToken).mockReturnValue({ valid: true, address: VALID_ADDRESS_B });
    const res2 = await GET(req2, { params: {} });
    expect(res2.status).toBe(200);

    // Should fetch for each wallet
    expect(getUserCommitmentsFromChain).toHaveBeenCalledTimes(2);
  });
});
