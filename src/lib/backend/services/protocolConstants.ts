/**
 * Protocol Constants Service
 *
 * Public, non-sensitive protocol parameters used by API calculations and
 * creation-flow UX. Values are cached for the process lifetime.
 */

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
  /** null means the profile intentionally has no automatic stop-loss. */
  maxLossPercent: number | null;
}

export interface ProtocolConstants {
  protocolVersion: string;
  network: string;
  fees: FeeConstants;
  penalties: PenaltyTier[];
  commitmentTypes: CommitmentTypeConstants[];
  commitmentLimits: CommitmentLimits;
  cachedAt: string;
}

const DEFAULT_NETWORK_BASE_FEE_STROOPS = 100;
const DEFAULT_PLATFORM_FEE_PERCENT = 0;

const DEFAULT_MIN_AMOUNT_XLM = 10;
const DEFAULT_MAX_AMOUNT_XLM = 1_000_000;
const DEFAULT_MIN_DURATION_DAYS = 1;
const DEFAULT_MAX_DURATION_DAYS = 365;
const DEFAULT_MAX_LOSS_PERCENT_CEILING = 100;
const DEFAULT_EARLY_EXIT_GRACE_PERIOD_DAYS = 7;

const DEFAULT_PENALTY_TIERS: PenaltyTier[] = [
  {
    type: 'safe',
    earlyExitPenaltyPercent: 2,
    description: 'Low-risk commitment with a 2% early-exit penalty.',
  },
  {
    type: 'balanced',
    earlyExitPenaltyPercent: 3,
    description: 'Moderate-risk commitment with a 3% early-exit penalty.',
  },
  {
    type: 'aggressive',
    earlyExitPenaltyPercent: 5,
    description: 'High-risk commitment with a 5% early-exit penalty.',
  },
];

const DEFAULT_COMMITMENT_TYPES: CommitmentTypeConstants[] = [
  { type: 'safe', durationDays: 30, maxLossPercent: 2 },
  { type: 'balanced', durationDays: 60, maxLossPercent: 8 },
  { type: 'aggressive', durationDays: 90, maxLossPercent: null },
];

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function parsePenaltyTiersFromEnv(): PenaltyTier[] | null {
  const raw = process.env.COMMITLABS_PENALTY_TIERS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('COMMITLABS_PENALTY_TIERS_JSON must be a JSON array');
    }

    return parsed.map((tier: Record<string, unknown>, index: number) => {
      if (typeof tier.type !== 'string' || !tier.type) {
        throw new Error(`Penalty tier at index ${index} is missing a valid "type".`);
      }
      if (
        typeof tier.earlyExitPenaltyPercent !== 'number' ||
        !Number.isFinite(tier.earlyExitPenaltyPercent)
      ) {
        throw new Error(
          `Penalty tier "${tier.type}" is missing a finite "earlyExitPenaltyPercent".`,
        );
      }
      return {
        type: tier.type,
        earlyExitPenaltyPercent: tier.earlyExitPenaltyPercent,
        description:
          typeof tier.description === 'string'
            ? tier.description
            : `${tier.type} commitment with a ${tier.earlyExitPenaltyPercent}% early-exit penalty.`,
      };
    });
  } catch (error) {
    throw new Error(
      `Failed to parse COMMITLABS_PENALTY_TIERS_JSON: ${(error as Error).message}`,
    );
  }
}

let cached: ProtocolConstants | null = null;

export function invalidateProtocolConstantsCache(): void {
  cached = null;
}

export function getProtocolConstants(): ProtocolConstants {
  if (cached) return cached;

  const protocolVersion = envString(
    'NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION',
    envString('ACTIVE_CONTRACT_VERSION', 'v1'),
  );
  const network = envString(
    'SOROBAN_NETWORK_PASSPHRASE',
    envString('NEXT_PUBLIC_NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015'),
  );
  const penalties = parsePenaltyTiersFromEnv() ?? DEFAULT_PENALTY_TIERS;

  cached = {
    protocolVersion,
    network,
    fees: {
      networkBaseFeeStroops: envInt(
        'COMMITLABS_NETWORK_BASE_FEE_STROOPS',
        DEFAULT_NETWORK_BASE_FEE_STROOPS,
      ),
      platformFeePercent: envFloat(
        'COMMITLABS_PLATFORM_FEE_PERCENT',
        DEFAULT_PLATFORM_FEE_PERCENT,
      ),
    },
    penalties,
    commitmentTypes: DEFAULT_COMMITMENT_TYPES,
    commitmentLimits: {
      minAmountXlm: envInt('COMMITLABS_MIN_AMOUNT_XLM', DEFAULT_MIN_AMOUNT_XLM),
      maxAmountXlm: envInt('COMMITLABS_MAX_AMOUNT_XLM', DEFAULT_MAX_AMOUNT_XLM),
      minDurationDays: envInt(
        'COMMITLABS_MIN_DURATION_DAYS',
        DEFAULT_MIN_DURATION_DAYS,
      ),
      maxDurationDays: envInt(
        'COMMITLABS_MAX_DURATION_DAYS',
        DEFAULT_MAX_DURATION_DAYS,
      ),
      maxLossPercentCeiling: envInt(
        'COMMITLABS_MAX_LOSS_PERCENT_CEILING',
        DEFAULT_MAX_LOSS_PERCENT_CEILING,
      ),
      earlyExitGracePeriodDays: envInt(
        'COMMITLABS_EARLY_EXIT_GRACE_PERIOD_DAYS',
        DEFAULT_EARLY_EXIT_GRACE_PERIOD_DAYS,
      ),
    },
    cachedAt: new Date().toISOString(),
  };

  return cached;
}
