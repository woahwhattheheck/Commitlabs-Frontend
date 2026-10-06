import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, attachSecurityHeaders } from '@/lib/backend/apiResponse';
import { logInfo } from '@/lib/backend/logger';
import { getProtocolConstants } from '@/lib/backend/services/protocolConstants';

/**
 * GET /api/protocol/constants
 *
 * Public protocol parameters used by calculations and creation-flow UX.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  logInfo(req, 'Protocol constants requested');

  const response = ok(getProtocolConstants());
  response.headers.set(
    'Cache-Control',
    'public, max-age=300, stale-while-revalidate=60',
  );

  return attachSecurityHeaders(response);
});
