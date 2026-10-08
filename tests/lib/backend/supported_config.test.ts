import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ValidatedEnv } from '@/lib/backend/env';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as Partial<ValidatedEnv>,
}));

vi.mock('@/lib/backend/env', () => ({
  getValidatedEnv: () => mockEnv,
}));

import { getSupportedConfig, RISK_PROFILES, SUPPORTED_ASSETS } from '@/lib/backend/config';

describe('supported config overrides', () => {
  beforeEach(() => {
    Object.keys(mockEnv).forEach((key) => delete mockEnv[key as keyof ValidatedEnv]);
  });

  it('returns the existing supported assets and risk profiles by default', () => {
    const config = getSupportedConfig();

    expect(config.assets).toEqual(SUPPORTED_ASSETS);
    expect(config.riskProfiles).toEqual(RISK_PROFILES);
  });

  it('uses COMMITLABS_SUPPORTED_CONFIG_JSON assets and risk profiles when provided', () => {
    const assets = [{ code: 'EURC', name: 'Euro Coin', decimals: 7 }];
    const riskProfiles = [
      {
        id: 'moderate',
        name: 'Moderate',
        description: 'Custom deployment threshold',
        maxLossBps: 2500,
        lockDurationDays: 45,
      },
    ];

    mockEnv.COMMITLABS_SUPPORTED_CONFIG_JSON = JSON.stringify({ assets, riskProfiles });

    const config = getSupportedConfig();

    expect(config.assets).toEqual(assets);
    expect(config.riskProfiles).toEqual(riskProfiles);
  });

  it('rejects loss tolerances and lock durations outside configured bounds', () => {
    const allowed = {
      id: 'bounded',
      name: 'Bounded',
      description: 'Boundary values',
      maxLossBps: 10000,
      lockDurationDays: 365,
    };

    mockEnv.COMMITLABS_SUPPORTED_CONFIG_JSON = JSON.stringify({ riskProfiles: [allowed] });
    expect(getSupportedConfig().riskProfiles).toEqual([allowed]);

    for (const invalid of [
      { ...allowed, maxLossBps: 10001 },
      { ...allowed, lockDurationDays: 366 },
    ]) {
      mockEnv.COMMITLABS_SUPPORTED_CONFIG_JSON = JSON.stringify({ riskProfiles: [invalid] });
      expect(() => getSupportedConfig()).toThrow(
        'COMMITLABS_SUPPORTED_CONFIG_JSON.riskProfiles',
      );
    }
  });
});
