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

  it('isolates returned assets, profiles, and bounds from subsequent reads', () => {
    const first = getSupportedConfig();
    first.assets[0]!.code = 'MODIFIED';
    first.riskProfiles[0]!.maxLossBps = -1;
    first.bounds.durationDays.min = -100;
    first.bounds.amount.max = -100;

    const second = getSupportedConfig();
    expect(second.assets[0]!.code).toBe('XLM');
    expect(second.riskProfiles[0]!.maxLossBps).toBe(1000);
    expect(second.bounds.durationDays.min).toBe(1);
    expect(second.bounds.amount.max).toBe(1000000);
    expect(SUPPORTED_ASSETS[0]!.code).toBe('XLM');
    expect(RISK_PROFILES[0]!.maxLossBps).toBe(1000);

    mockEnv.COMMITLABS_SUPPORTED_CONFIG_JSON = JSON.stringify({
      assets: [{ code: 'EURC', name: 'Euro Coin', decimals: 7 }],
      riskProfiles: [{
        id: 'moderate', name: 'Moderate', description: 'Snapshot isolation',
        maxLossBps: 2500, lockDurationDays: 45,
      }],
    });
    const overridden = getSupportedConfig();
    overridden.assets[0]!.code = 'CHANGED';
    overridden.riskProfiles[0]!.maxLossBps = -1;
    expect(getSupportedConfig().assets[0]!.code).toBe('EURC');
    expect(getSupportedConfig().riskProfiles[0]!.maxLossBps).toBe(2500);
  });
});
