/**
 * Security-sensitive authorization invariants for commitment details.
 *
 * Kept outside the Next.js route module so both the page and focused tests
 * share one implementation, without exporting non-route functions from a page.
 */
export type OwnershipState =
  | { kind: 'wallet_disconnected' }
  | { kind: 'wrong_network'; reason: string }
  | { kind: 'not_owner' }
  | { kind: 'authorized' };

interface WalletSnapshot {
  connected: boolean;
  address: string;
  error: string | null;
}

/** Reject malformed IDs before they are used in routes or telemetry. */
export function isValidCommitmentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/** Never allow an ownership-sensitive action on a disconnected/wrong wallet. */
export function deriveOwnership(
  wallet: WalletSnapshot,
  ownerAddress: string,
): OwnershipState {
  if (!wallet?.connected || typeof wallet.address !== 'string' || !wallet.address) {
    return { kind: 'wallet_disconnected' };
  }
  if (wallet.error) {
    return { kind: 'wrong_network', reason: wallet.error };
  }
  if (!ownerAddress || wallet.address !== ownerAddress) {
    return { kind: 'not_owner' };
  }
  return { kind: 'authorized' };
}

export function isAuthorized(state: OwnershipState): boolean {
  return state.kind === 'authorized';
}

export function ownershipDisabledReason(state: OwnershipState): string | undefined {
  switch (state.kind) {
    case 'wallet_disconnected':
      return 'Connect your wallet to perform this action.';
    case 'wrong_network':
      return state.reason;
    case 'not_owner':
      return 'Only the commitment owner can perform this action.';
    case 'authorized':
      return undefined;
  }
}

const KNOWN_STATUSES = new Set([
  'active', 'created', 'funded', 'disputed', 'settled', 'violated', 'early_exit',
]);

/** Prevent unexpected server status values from appearing as Active. */
export function isKnownStatusValue(value: unknown): value is string {
  return typeof value === 'string' &&
    KNOWN_STATUSES.has(value.trim().toLowerCase().replace(/\s+/g, '_'));
}

/** Fail closed while loading, after expiry, or for any unexpected status. */
export function isEligibleForEarlyExit(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.status === 'string' &&
    state.status.toLowerCase() === 'active' &&
    typeof state.daysRemaining === 'number' &&
    Number.isFinite(state.daysRemaining) &&
    state.daysRemaining > 0
  );
}
