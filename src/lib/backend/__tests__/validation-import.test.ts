import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_ASSETS,
  validateCommitmentId,
  validateStellarAddress,
  validateSupportedAsset,
} from '@/lib/backend/validation';

describe('validation module', () => {
  it('loads and exposes supported asset validation', () => {
    expect(SUPPORTED_ASSETS).toEqual(['XLM', 'USDC']);
    expect(() => validateSupportedAsset('xlm')).not.toThrow();
    expect(() => validateSupportedAsset('USDC')).not.toThrow();
    expect(() => validateSupportedAsset('BTC')).toThrow(/not supported/);
  });

  it('keeps other validator exports importable', () => {
    expect(() => validateStellarAddress('invalid')).toThrow(/Stellar public key/);
    expect(validateCommitmentId('commitment_1')).toBe('commitment_1');
  });
});
