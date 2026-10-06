/**
 * P26B Tests: Event/News PIT Contract Utils
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

import {
  buildEventNewsPitContractV0,
  validateContractV0,
  getContractV0NonScoringSourceNames,
  EVENT_NEWS_FIELD_SPECS,
  FORBIDDEN_FIELDS,
  P26B_CONTRACT_VERSION,
} from '../P26BEventNewsPitContractUtils';

describe('P26B Event/News PIT Contract v0', () => {
  describe('buildEventNewsPitContractV0', () => {
    it('returns a valid contract', () => {
      const c = buildEventNewsPitContractV0();
      const { valid, errors } = validateContractV0(c);
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('entersAlphaScore is false', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.entersAlphaScore).toBe(false);
    });

    it('entersRecommendationBucket is false', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.entersRecommendationBucket).toBe(false);
    });

    it('readOnly is true', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.readOnly).toBe(true);
    });

    it('entersReasonContext is true', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.entersReasonContext).toBe(true);
    });

    it('entersFactorSnapshot is false', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.entersFactorSnapshot).toBe(false);
    });

    it('pitVisibilityRule references publishedAt', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.pitVisibilityRule).toContain('publishedAt');
    });

    it('ingestedAtRule says must NOT', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.ingestedAtRule).toContain('must NOT');
    });

    it('timezoneRule references Asia/Taipei', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.timezoneRule).toContain('Asia/Taipei');
    });

    it('version is correct', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.version).toBe(P26B_CONTRACT_VERSION);
    });

    it('does not promise performance improvement', () => {
      const c = buildEventNewsPitContractV0();
      // Check that no positive performance claim is made (disclaimer text is allowed)
      const nonGoalsText = c.nonGoals.join(' ').toLowerCase();
      expect(nonGoalsText).toContain('no performance improvement claimed');
      expect(c.entersAlphaScore).toBe(false);
    });

    it('does not contain outcome fields', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.forbiddenFields).toContain('outcomePrice');
      expect(c.forbiddenFields).toContain('returnPct');
      expect(c.forbiddenFields).toContain('realizedReturnClass');
    });

    it('does not claim NewsEvent is in scoring', () => {
      const c = buildEventNewsPitContractV0();
      // The contract must not positively claim NewsEvent enters scoring
      expect(c.entersAlphaScore).toBe(false);
      expect(c.entersRecommendationBucket).toBe(false);
      expect(c.entersFactorSnapshot).toBe(false);
      // nonGoals must mention that NewsEvent does not enter scoring
      const nonGoalsText = c.nonGoals.join(' ').toLowerCase();
      expect(nonGoalsText).toContain('alphascore');
    });

    it('returns deep copy — mutations do not affect module constant', () => {
      const c1 = buildEventNewsPitContractV0();
      const c2 = buildEventNewsPitContractV0();
      c1.forbiddenFields.push('INJECTED_FIELD');
      expect(c2.forbiddenFields).not.toContain('INJECTED_FIELD');
    });
  });

  describe('publishedAt field', () => {
    it('is marked REQUIRED', () => {
      const c = buildEventNewsPitContractV0();
      const f = c.fields.find(x => x.fieldName === 'publishedAt');
      expect(f).toBeDefined();
      expect(f!.status).toBe('REQUIRED');
    });
  });

  describe('ingestedAt field', () => {
    it('is marked OBSERVABILITY_ONLY', () => {
      const c = buildEventNewsPitContractV0();
      const f = c.fields.find(x => x.fieldName === 'ingestedAt');
      expect(f).toBeDefined();
      expect(f!.status).toBe('OBSERVABILITY_ONLY');
    });
  });

  describe('forbidden fields', () => {
    it('includes all outcome fields', () => {
      const c = buildEventNewsPitContractV0();
      expect(c.forbiddenFields).toContain('outcomePrice');
      expect(c.forbiddenFields).toContain('returnPct');
      expect(c.forbiddenFields).toContain('realizedReturnClass');
    });

    it('module FORBIDDEN_FIELDS list is complete', () => {
      expect(FORBIDDEN_FIELDS).toContain('outcomePrice');
      expect(FORBIDDEN_FIELDS).toContain('returnPct');
      expect(FORBIDDEN_FIELDS).toContain('realizedReturnClass');
    });
  });

  describe('nonGoals', () => {
    it('states NewsEvent does not enter alphaScore', () => {
      const c = buildEventNewsPitContractV0();
      const combined = c.nonGoals.join(' ').toLowerCase();
      expect(combined).toContain('alphascore');
    });

    it('does not promise activation date for NewsEvent scoring', () => {
      const c = buildEventNewsPitContractV0();
      const combined = c.nonGoals.join(' ').toLowerCase();
      expect(combined).not.toMatch(/will.*enter.*scoring|scoring.*activated/);
    });
  });

  describe('getContractV0NonScoringSourceNames', () => {
    it('returns NewsEvent', () => {
      const c = buildEventNewsPitContractV0();
      const names = getContractV0NonScoringSourceNames(c);
      expect(names).toContain('NewsEvent');
    });
  });

  describe('validateContractV0', () => {
    it('fails if entersAlphaScore is not false', () => {
      const c = buildEventNewsPitContractV0();
      // @ts-expect-error intentional mutation for test
      c.entersAlphaScore = true;
      const { valid, errors } = validateContractV0(c);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes('entersAlphaScore'))).toBe(true);
    });

    it('fails if readOnly is not true', () => {
      const c = buildEventNewsPitContractV0();
      // @ts-expect-error intentional mutation for test
      c.readOnly = false;
      const { valid, errors } = validateContractV0(c);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes('readOnly'))).toBe(true);
    });

    it('fails if ingestedAtRule missing "must NOT"', () => {
      const c = buildEventNewsPitContractV0();
      c.ingestedAtRule = 'ingestedAt can be used as fallback gate';
      const { valid, errors } = validateContractV0(c);
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes('ingestedAtRule'))).toBe(true);
    });
  });

  describe('no forbidden claims in source code pattern', () => {
    it('has no Math.random reference', () => {
      const source = require('fs').readFileSync(
        require('path').join(__dirname, '../P26BEventNewsPitContractUtils.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/Math\.random\(\)/);
    });

    it('has no external API call', () => {
      const source = require('fs').readFileSync(
        require('path').join(__dirname, '../P26BEventNewsPitContractUtils.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/fetch\(|axios\.|https?\.(get|post)\(/);
    });
  });
});
