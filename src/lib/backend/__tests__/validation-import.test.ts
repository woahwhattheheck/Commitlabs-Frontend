import Stellar from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  STELLAR_PUBLIC_KEY_REGEX,
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

  it('accepts real Stellar Base32 addresses and rejects non-Base32 digits', () => {
    const publicKey = Stellar.Keypair.random().publicKey();
    expect(STELLAR_PUBLIC_KEY_REGEX.test(publicKey)).toBe(true);
    expect(() => validateStellarAddress(publicKey)).not.toThrow();

    // Letters I, L, and O are valid RFC 4648 symbols; 0, 1, 8, and 9 are not.
    expect(STELLAR_PUBLIC_KEY_REGEX.test('G' + 'IOL'.repeat(18) + 'I')).toBe(true);
    for (const digit of ['0', '1', '8', '9']) {
      const invalid = 'G' + 'A'.repeat(54) + digit;
      expect(STELLAR_PUBLIC_KEY_REGEX.test(invalid)).toBe(false);
      expect(() => validateStellarAddress(invalid)).toThrow(/Stellar public key/);
    }
  });
});
