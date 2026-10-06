import {
  ProtocolConstantsResponseSchema,
  ProtocolConstantsSchema,
} from '@/lib/schemas/apiContracts';

export interface PenaltyTier {
  type: string;
  earlyExitPenaltyPercent: number;
  description: string;
}

export interface FeeConstants {
  networkBaseFeeStroops: number;
  platformFeePercent: number;
}

export interface CommitmentLimits {
  minAmountXlm: number;
  maxAmountXlm: number;
  minDurationDays: number;
  maxDurationDays: number;
  maxLossPercentCeiling: number;
  earlyExitGracePeriodDays: number;
}

export type CommitmentTypeId = 'safe' | 'balanced' | 'aggressive';

export interface CommitmentTypeConstants {
  type: CommitmentTypeId;
  durationDays: number;
  maxLossPercent: number | null;
}

export interface ProtocolConstants {
  protocolVersion: string;
  network: string;
  fees: FeeConstants;
  penalties: PenaltyTier[];
  commitmentTypes?: CommitmentTypeConstants[];
  commitmentLimits: CommitmentLimits;
  cachedAt: string;
}

export { ProtocolConstantsSchema, ProtocolConstantsResponseSchema };

function parseCommitmentTypes(value: unknown): CommitmentTypeConstants[] | undefined {
  if (typeof value !== 'object' || value === null || !('commitmentTypes' in value)) {
    return undefined;
  }

  const raw = (value as { commitmentTypes?: unknown }).commitmentTypes;
  if (!Array.isArray(raw)) {
    throw new Error('Failed to validate protocol constants response payload: commitmentTypes must be an array');
  }

  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Failed to validate protocol constants response payload: commitmentTypes.${index} must be an object`,
      );
    }

    const item = entry as {
      type?: unknown;
      durationDays?: unknown;
      maxLossPercent?: unknown;
    };

    if (!['safe', 'balanced', 'aggressive'].includes(String(item.type))) {
      throw new Error(
        `Failed to validate protocol constants response payload: commitmentTypes.${index}.type is invalid`,
      );
    }
    if (
      typeof item.durationDays !== 'number' ||
      !Number.isInteger(item.durationDays) ||
      item.durationDays <= 0
    ) {
      throw new Error(
        `Failed to validate protocol constants response payload: commitmentTypes.${index}.durationDays is invalid`,
      );
    }
    if (
      item.maxLossPercent !== null &&
      (typeof item.maxLossPercent !== 'number' ||
        !Number.isFinite(item.maxLossPercent) ||
        item.maxLossPercent < 0 ||
        item.maxLossPercent > 100)
    ) {
      throw new Error(
        `Failed to validate protocol constants response payload: commitmentTypes.${index}.maxLossPercent is invalid`,
      );
    }

    return {
      type: item.type as CommitmentTypeId,
      durationDays: item.durationDays,
      maxLossPercent: item.maxLossPercent as number | null,
    };
  });
}

function payloadData(json: unknown): unknown {
  if (
    typeof json === 'object' &&
    json !== null &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: unknown }).data;
  }
  return json;
}

/**
 * Fetches and validates protocol constants from the API endpoint.
 */
export async function fetchProtocolConstants(
  endpoint = '/api/protocol/constants',
): Promise<ProtocolConstants> {
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch protocol constants: ${response.statusText}`);
  }

  const json: unknown = await response.json();
  const extraCommitmentTypes = parseCommitmentTypes(payloadData(json));

  const envelopedParsed = ProtocolConstantsResponseSchema.safeParse(json);
  if (envelopedParsed.success) {
    return {
      ...envelopedParsed.data.data,
      commitmentTypes: extraCommitmentTypes,
    };
  }

  const directParsed = ProtocolConstantsSchema.safeParse(json);
  if (directParsed.success) {
    return {
      ...directParsed.data,
      commitmentTypes: extraCommitmentTypes,
    };
  }

  const isEnvelopedShape =
    typeof json === 'object' && json !== null && 'data' in json && 'success' in json;

  const relevantError = isEnvelopedShape ? envelopedParsed.error : directParsed.error;

  const issues = relevantError?.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');

  throw new Error(`Failed to validate protocol constants response payload: ${issues}`);
}

/**
 * Extracts and normalizes the early exit grace period duration in days.
 */
export function getEarlyExitGracePeriodDays(
  constants: ProtocolConstants | null | undefined,
): number {
  const value = constants?.commitmentLimits?.earlyExitGracePeriodDays;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
