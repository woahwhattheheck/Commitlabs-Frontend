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
});
