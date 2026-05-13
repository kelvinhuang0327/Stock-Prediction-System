import {
  buildFinancialReportPitContractV0,
  validateFinancialReportContractV0,
  FinancialReportPitContractV0,
} from '../P26CFinancialReportAvailabilityContractUtils';

describe('P26C FinancialReport Availability Contract v0', () => {
  let contract: FinancialReportPitContractV0;

  beforeEach(() => {
    contract = buildFinancialReportPitContractV0();
  });

  describe('contract structure', () => {
    it('builds a contract v0 object', () => {
      expect(contract).toBeDefined();
      expect(contract.version).toBe('p26c-financial-report-availability-contract-v0');
    });

    it('sets entersAlphaScore=false', () => {
      expect(contract.entersAlphaScore).toBe(false);
    });

    it('sets entersRecommendationBucket=false', () => {
      expect(contract.entersRecommendationBucket).toBe(false);
    });

    it('sets readOnly=true', () => {
      expect(contract.readOnly).toBe(true);
    });

    it('sets entersReasonContext=true', () => {
      expect(contract.entersReasonContext).toBe(true);
    });

    it('sets entersFactorSnapshot=false', () => {
      expect(contract.entersFactorSnapshot).toBe(false);
    });
  });

  describe('PIT visibility rule', () => {
    it('defines availabilityDate priority order', () => {
      expect(contract.availabilityDatePriority).toEqual([
        'filingDate', 'announcementDate', 'publishedAt', 'availableAt'
      ]);
    });

    it('explicitly forbids periodEndDate as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('periodEndDate');
    });

    it('explicitly forbids fiscalYear as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('fiscalYear');
    });

    it('explicitly forbids fiscalQuarter as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('fiscalQuarter');
    });

    it('explicitly forbids ingestedAt as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('ingestedAt');
    });

    it('explicitly forbids createdAt as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('createdAt');
    });

    it('explicitly forbids updatedAt as PIT gate', () => {
      expect(contract.forbiddenVisibilityGates).toContain('updatedAt');
    });
  });

  describe('field specifications', () => {
    it('marks filingDate as OPTIONAL (primary gate)', () => {
      const f = contract.fields.find(f => f.fieldName === 'filingDate');
      expect(f).toBeDefined();
      expect(f!.status).toBe('OPTIONAL');
    });

    it('marks ingestedAt as OBSERVABILITY_ONLY', () => {
      const f = contract.fields.find(f => f.fieldName === 'ingestedAt');
      expect(f).toBeDefined();
      expect(f!.status).toBe('OBSERVABILITY_ONLY');
    });

    it('marks createdAt as OBSERVABILITY_ONLY', () => {
      const f = contract.fields.find(f => f.fieldName === 'createdAt');
      expect(f?.status).toBe('OBSERVABILITY_ONLY');
    });

    it('marks updatedAt as OBSERVABILITY_ONLY', () => {
      const f = contract.fields.find(f => f.fieldName === 'updatedAt');
      expect(f?.status).toBe('OBSERVABILITY_ONLY');
    });

    it('includes metrics fields (fixture-only, no scoring)', () => {
      const epsField = contract.fields.find(f => f.fieldName === 'eps');
      expect(epsField).toBeDefined();
      expect(epsField!.description).toMatch(/fixture|no scoring|read-only/i);
    });
  });

  describe('forbidden fields', () => {
    it('forbids outcomePrice', () => {
      expect(contract.forbiddenFields).toContain('outcomePrice');
    });

    it('forbids returnPct', () => {
      expect(contract.forbiddenFields).toContain('returnPct');
    });

    it('forbids realizedReturnClass', () => {
      expect(contract.forbiddenFields).toContain('realizedReturnClass');
    });
  });

  describe('non-goals', () => {
    it('states FinancialReport does not enter alphaScore', () => {
      const hasNonGoal = contract.nonGoals.some(g => /alphaScore|scoring/.test(g));
      expect(hasNonGoal).toBe(true);
    });
  });

  describe('validation', () => {
    it('validates a correct contract', () => {
      const result = validateFinancialReportContractV0(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails if entersAlphaScore is true', () => {
      const bad = { ...contract, entersAlphaScore: true as unknown as false };
      const result = validateFinancialReportContractV0(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('fails if readOnly is false', () => {
      const bad = { ...contract, readOnly: false as unknown as true };
      const result = validateFinancialReportContractV0(bad);
      expect(result.valid).toBe(false);
    });

    it('fails if forbiddenVisibilityGates is missing periodEndDate', () => {
      const bad = { ...contract, forbiddenVisibilityGates: contract.forbiddenVisibilityGates.filter(g => g !== 'periodEndDate') };
      const result = validateFinancialReportContractV0(bad);
      expect(result.valid).toBe(false);
    });
  });

  describe('source file purity', () => {
    it('contract source has no Math.random calls', () => {
      const src = require('fs').readFileSync('src/lib/onlineValidation/P26CFinancialReportAvailabilityContractUtils.ts', 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });

    it('contract source has no external imports', () => {
      const src = require('fs').readFileSync('src/lib/onlineValidation/P26CFinancialReportAvailabilityContractUtils.ts', 'utf8');
      expect(src).not.toMatch(/^import.*from ['"][^.]/m);
    });
  });
});
