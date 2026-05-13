import {
  P26F_MAPPING_CONTRACT_VERSION,
  P26F_PIT_GATE_FIELD,
  P26F_PIT_RULES,
  P26F_CANDIDATE_OUTPUT_CONTRACT,
  P26F_OBSERVABILITY_ONLY_FIELDS,
  buildP26FMappingContractV1,
  validateP26FMappingContractCompleteness,
  isP26FVisibilityGateField,
  isP26FObservabilityOnlyField,
  getP26FPitGateField,
} from '../P26FMonthlyRevenueMappingContractUtils';
import * as fs from 'fs';
import * as path from 'path';

const SRC_PATH = path.resolve(__dirname, '../P26FMonthlyRevenueMappingContractUtils.ts');

describe('P26F MonthlyRevenue Mapping Contract Utils', () => {
  describe('contract version and constants', () => {
    it('P26F_MAPPING_CONTRACT_VERSION is v1', () => {
      expect(P26F_MAPPING_CONTRACT_VERSION).toBe('v1');
    });

    it('P26F_PIT_GATE_FIELD is releaseDate', () => {
      expect(P26F_PIT_GATE_FIELD).toBe('releaseDate');
    });

    it('getP26FPitGateField returns releaseDate', () => {
      expect(getP26FPitGateField()).toBe('releaseDate');
    });
  });

  describe('buildP26FMappingContractV1', () => {
    it('returns contract with releaseDate as PIT gate', () => {
      const contract = buildP26FMappingContractV1();
      expect(contract.pitGateField).toBe('releaseDate');
    });

    it('returns contract with phase P26F-HARDRESET', () => {
      const contract = buildP26FMappingContractV1();
      expect(contract.phase).toBe('P26F-HARDRESET');
    });

    it('returns contract with contractVersion v1', () => {
      const contract = buildP26FMappingContractV1();
      expect(contract.contractVersion).toBe('v1');
    });

    it('returns contract with disclaimer', () => {
      const contract = buildP26FMappingContractV1();
      expect(typeof contract.disclaimer).toBe('string');
      expect(contract.disclaimer.length).toBeGreaterThan(0);
    });
  });

  describe('P26F_PIT_RULES', () => {
    it('nullReleaseDateIsNotVisible is true', () => {
      expect(P26F_PIT_RULES.nullReleaseDateIsNotVisible).toBe(true);
    });

    it('yearMonthAreNotVisibilityGates is true', () => {
      expect(P26F_PIT_RULES.yearMonthAreNotVisibilityGates).toBe(true);
    });

    it('createdAtIsNotVisibilityGate is true', () => {
      expect(P26F_PIT_RULES.createdAtIsNotVisibilityGate).toBe(true);
    });

    it('visibilityGate is releaseDate <= asOfDate', () => {
      expect(P26F_PIT_RULES.visibilityGate).toBe('releaseDate <= asOfDate');
    });
  });

  describe('P26F_CANDIDATE_OUTPUT_CONTRACT', () => {
    it('entersAlphaScore is false', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.entersAlphaScore).toBe(false);
    });

    it('overwritesFrozenCorpus is false', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.overwritesFrozenCorpus).toBe(false);
    });

    it('readOnly is true', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.readOnly).toBe(true);
    });

    it('scoringChangeAllowed is false', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.scoringChangeAllowed).toBe(false);
    });

    it('optimizerAllowed is false', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.optimizerAllowed).toBe(false);
    });

    it('forbiddenOutputFields includes outcomePrice, returnPct, realizedReturnClass', () => {
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.forbiddenOutputFields).toContain('outcomePrice');
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.forbiddenOutputFields).toContain('returnPct');
      expect(P26F_CANDIDATE_OUTPUT_CONTRACT.forbiddenOutputFields).toContain('realizedReturnClass');
    });
  });

  describe('isP26FVisibilityGateField', () => {
    it('returns true for releaseDate', () => {
      expect(isP26FVisibilityGateField('releaseDate')).toBe(true);
    });

    it('returns false for year', () => {
      expect(isP26FVisibilityGateField('year')).toBe(false);
    });

    it('returns false for month', () => {
      expect(isP26FVisibilityGateField('month')).toBe(false);
    });

    it('returns false for createdAt', () => {
      expect(isP26FVisibilityGateField('createdAt')).toBe(false);
    });

    it('returns false for revenue', () => {
      expect(isP26FVisibilityGateField('revenue')).toBe(false);
    });

    it('returns false for releaseDateSource', () => {
      expect(isP26FVisibilityGateField('releaseDateSource')).toBe(false);
    });
  });

  describe('isP26FObservabilityOnlyField', () => {
    it('returns true for createdAt', () => {
      expect(isP26FObservabilityOnlyField('createdAt')).toBe(true);
    });

    it('returns true for releaseDateSource', () => {
      expect(isP26FObservabilityOnlyField('releaseDateSource')).toBe(true);
    });

    it('returns true for releaseDateConfidence', () => {
      expect(isP26FObservabilityOnlyField('releaseDateConfidence')).toBe(true);
    });

    it('returns true for year', () => {
      expect(isP26FObservabilityOnlyField('year')).toBe(true);
    });

    it('returns true for month', () => {
      expect(isP26FObservabilityOnlyField('month')).toBe(true);
    });

    it('returns false for releaseDate (releaseDate is visibility gate, not observability only)', () => {
      expect(isP26FObservabilityOnlyField('releaseDate')).toBe(false);
    });
  });

  describe('P26F_OBSERVABILITY_ONLY_FIELDS', () => {
    it('includes createdAt', () => {
      expect(P26F_OBSERVABILITY_ONLY_FIELDS).toContain('createdAt');
    });

    it('includes releaseDateSource', () => {
      expect(P26F_OBSERVABILITY_ONLY_FIELDS).toContain('releaseDateSource');
    });

    it('includes releaseDateConfidence', () => {
      expect(P26F_OBSERVABILITY_ONLY_FIELDS).toContain('releaseDateConfidence');
    });
  });

  describe('validateP26FMappingContractCompleteness', () => {
    it('passes for complete contract', () => {
      const contract = buildP26FMappingContractV1();
      const result = validateP26FMappingContractCompleteness(contract);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('fails when pitGateField is missing', () => {
      const contract = buildP26FMappingContractV1();
      const incomplete = { ...contract } as Record<string, unknown>;
      delete incomplete['pitGateField'];
      const result = validateP26FMappingContractCompleteness(incomplete as any);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('pitGateField');
    });
  });

  describe('source code constraints', () => {
    it('source does not contain Math.random()', () => {
      const src = fs.readFileSync(SRC_PATH, 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });

    it('source has no external imports (only relative or none)', () => {
      const src = fs.readFileSync(SRC_PATH, 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
  });
});
