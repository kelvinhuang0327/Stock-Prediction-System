/**
 * T-11: FreshnessAlert Tests
 *
 * Tests computeFreshnessAlert() for all alert levels.
 * No DB writes. No strategy signals. No ROI/win-rate.
 */

import { computeFreshnessAlert } from '@/lib/marketRegimeResult';
import type { PersistedRegimeContext, MissingRegimeContext } from '@/lib/marketRegimeResult';

const FORBIDDEN_FIELDS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];

function makePersistedCtx(date: string, lagDays: number): PersistedRegimeContext {
  const freshnessStatus =
    lagDays < 0 ? 'FUTURE_DATE_ERROR' : lagDays > 3 ? 'STALE' : 'FRESH';
  return {
    date,
    regimeLabel: 'BULL',
    confidence: 1.0,
    taiexClose: 41138.85,
    source: 'P4_03_MARKET_REGIME_CLASSIFIER',
    version: 'p4_03b_v1',
    freshnessStatus,
    freshnessLagDays: lagDays,
    warning: freshnessStatus === 'FUTURE_DATE_ERROR'
      ? `Persisted regime date ${date} is after currentDate`
      : freshnessStatus === 'STALE'
        ? `Regime data is ${lagDays} calendar days old`
        : null,
    isAvailable: true,
  };
}

const MISSING_CTX: MissingRegimeContext = {
  isAvailable: false,
  freshnessStatus: 'MISSING',
  freshnessLagDays: -1,
  warning: 'No MarketRegimeResult records found in DB',
};

describe('computeFreshnessAlert', () => {
  it('returns FRESH when lag = 0', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-06', 0), '2026-05-06');
    expect(alert.alertLevel).toBe('FRESH');
    expect(alert.freshnessLagDays).toBe(0);
    expect(alert.requiresAction).toBe(false);
    expect(alert.message).toBeNull();
  });

  it('returns FRESH when lag = 3', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-03', 3), '2026-05-06');
    expect(alert.alertLevel).toBe('FRESH');
    expect(alert.freshnessLagDays).toBe(3);
    expect(alert.requiresAction).toBe(false);
  });

  it('returns STALE when lag = 4', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-02', 4), '2026-05-06');
    expect(alert.alertLevel).toBe('STALE');
    expect(alert.freshnessLagDays).toBe(4);
    expect(alert.requiresAction).toBe(true);
    expect(alert.message).toBeTruthy();
  });

  it('returns STALE when lag = 7', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-04-29', 7), '2026-05-06');
    expect(alert.alertLevel).toBe('STALE');
    expect(alert.freshnessLagDays).toBe(7);
    expect(alert.requiresAction).toBe(true);
  });

  it('returns CRITICAL_STALE when lag = 8', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-04-28', 8), '2026-05-06');
    expect(alert.alertLevel).toBe('CRITICAL_STALE');
    expect(alert.freshnessLagDays).toBe(8);
    expect(alert.requiresAction).toBe(true);
    expect(alert.message).toContain('critically stale');
  });

  it('returns MISSING when context is not available', () => {
    const alert = computeFreshnessAlert(MISSING_CTX, '2026-05-06');
    expect(alert.alertLevel).toBe('MISSING');
    expect(alert.freshnessLagDays).toBeNull();
    expect(alert.lastRegimeDate).toBeNull();
    expect(alert.requiresAction).toBe(true);
    expect(alert.message).toBeTruthy();
  });

  it('returns FUTURE_DATE_ERROR when regime date > currentDate', () => {
    const ctx = makePersistedCtx('2026-05-10', -4);
    ctx.freshnessStatus = 'FUTURE_DATE_ERROR';
    const alert = computeFreshnessAlert(ctx, '2026-05-06');
    expect(alert.alertLevel).toBe('FUTURE_DATE_ERROR');
    expect(alert.requiresAction).toBe(true);
    expect(alert.message).toBeTruthy();
  });

  it('requiresAction is false ONLY for FRESH', () => {
    expect(computeFreshnessAlert(makePersistedCtx('2026-05-06', 0), '2026-05-06').requiresAction).toBe(false);
    expect(computeFreshnessAlert(makePersistedCtx('2026-05-02', 4), '2026-05-06').requiresAction).toBe(true);
    expect(computeFreshnessAlert(makePersistedCtx('2026-04-28', 8), '2026-05-06').requiresAction).toBe(true);
    expect(computeFreshnessAlert(MISSING_CTX, '2026-05-06').requiresAction).toBe(true);
  });

  it('alert message exists for STALE / CRITICAL_STALE / MISSING / FUTURE_DATE_ERROR', () => {
    const stale = computeFreshnessAlert(makePersistedCtx('2026-05-02', 4), '2026-05-06');
    const critical = computeFreshnessAlert(makePersistedCtx('2026-04-28', 8), '2026-05-06');
    const missing = computeFreshnessAlert(MISSING_CTX, '2026-05-06');
    const futureCtx = makePersistedCtx('2026-05-10', -4);
    futureCtx.freshnessStatus = 'FUTURE_DATE_ERROR';
    const future = computeFreshnessAlert(futureCtx, '2026-05-06');
    expect(stale.message).toBeTruthy();
    expect(critical.message).toBeTruthy();
    expect(missing.message).toBeTruthy();
    expect(future.message).toBeTruthy();
  });

  it('does not include forbidden fields in alert object', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-06', 0), '2026-05-06');
    const keys = Object.keys(alert);
    FORBIDDEN_FIELDS.forEach(field => {
      expect(keys).not.toContain(field);
    });
  });

  it('currentDate is present in alert object', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-06', 0), '2026-05-06');
    expect(alert.currentDate).toBe('2026-05-06');
  });

  it('lastRegimeDate is populated for available context', () => {
    const alert = computeFreshnessAlert(makePersistedCtx('2026-05-06', 0), '2026-05-06');
    expect(alert.lastRegimeDate).toBe('2026-05-06');
  });
});
