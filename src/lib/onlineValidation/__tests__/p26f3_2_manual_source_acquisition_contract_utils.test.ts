import {
  P26F3_2_TARGET_PERIODS,
  P26F3_2_TARGET_SYMBOLS,
  P26F3_2_DRY_RUN_CONTRACT,
  P26F3_2_FORBIDDEN_FIELDS,
  P26F3_2_ACCEPTED_FORMATS,
  P26F3_2_ALLOWED_SOURCE_NAMES,
  buildP26F32ManualSourceAcquisitionContractV1,
  validateP26F32ContractCompleteness,
  isP26F32PeriodInTargetRange,
  isP26F32SymbolInTargetSet,
  isP26F32FormatAccepted,
  isP26F32SourceNameAllowed,
  detectP26F32ForbiddenFields,
} from '../P26F32ManualSourceAcquisitionContractUtils';

describe('P26F32 Manual Source Acquisition Contract Utils', () => {
  describe('Target periods', () => {
    it('has exactly 5 target periods', () => {
      expect(P26F3_2_TARGET_PERIODS).toHaveLength(5);
    });
    it('includes 2025-09 through 2026-01', () => {
      expect(P26F3_2_TARGET_PERIODS).toContain('2025-09');
      expect(P26F3_2_TARGET_PERIODS).toContain('2025-10');
      expect(P26F3_2_TARGET_PERIODS).toContain('2025-11');
      expect(P26F3_2_TARGET_PERIODS).toContain('2025-12');
      expect(P26F3_2_TARGET_PERIODS).toContain('2026-01');
    });
    it('does not include future or past periods outside range', () => {
      expect(P26F3_2_TARGET_PERIODS).not.toContain('2025-08');
      expect(P26F3_2_TARGET_PERIODS).not.toContain('2026-02');
    });
  });

  describe('Target symbols', () => {
    it('has exactly 25 target symbols', () => {
      expect(P26F3_2_TARGET_SYMBOLS).toHaveLength(25);
    });
    it('includes known symbols', () => {
      expect(P26F3_2_TARGET_SYMBOLS).toContain('2330');
      expect(P26F3_2_TARGET_SYMBOLS).toContain('0055');
      expect(P26F3_2_TARGET_SYMBOLS).toContain('6415');
    });
  });

  describe('Dry run contract', () => {
    it('dbWriteAllowed = false', () => {
      expect(P26F3_2_DRY_RUN_CONTRACT.dbWriteAllowed).toBe(false);
    });
    it('corpusWriteAllowed = false', () => {
      expect(P26F3_2_DRY_RUN_CONTRACT.corpusWriteAllowed).toBe(false);
    });
    it('scoringChangeAllowed = false', () => {
      expect(P26F3_2_DRY_RUN_CONTRACT.scoringChangeAllowed).toBe(false);
    });
    it('fabricatedDataAllowed = false', () => {
      expect(P26F3_2_DRY_RUN_CONTRACT.fabricatedDataAllowed).toBe(false);
    });
    it('externalFetchAllowed = false', () => {
      expect(P26F3_2_DRY_RUN_CONTRACT.externalFetchAllowed).toBe(false);
    });
  });

  describe('Forbidden fields', () => {
    it('includes outcomePrice, returnPct, realizedReturnClass', () => {
      expect(P26F3_2_FORBIDDEN_FIELDS).toContain('outcomePrice');
      expect(P26F3_2_FORBIDDEN_FIELDS).toContain('returnPct');
      expect(P26F3_2_FORBIDDEN_FIELDS).toContain('realizedReturnClass');
    });
  });

  describe('Accepted formats', () => {
    it('includes csv, json, jsonl', () => {
      expect(P26F3_2_ACCEPTED_FORMATS).toContain('csv');
      expect(P26F3_2_ACCEPTED_FORMATS).toContain('json');
      expect(P26F3_2_ACCEPTED_FORMATS).toContain('jsonl');
    });
  });

  describe('buildP26F32ManualSourceAcquisitionContractV1', () => {
    it('returns a complete contract object', () => {
      const contract = buildP26F32ManualSourceAcquisitionContractV1() as Record<string, unknown>;
      expect(contract).toHaveProperty('version');
      expect(contract).toHaveProperty('targetPeriods');
      expect(contract).toHaveProperty('targetSymbols');
      expect(contract).toHaveProperty('dryRunContract');
      expect(contract).toHaveProperty('pitRules');
    });
    it('contract dryRunContract.dbWriteAllowed = false', () => {
      const contract = buildP26F32ManualSourceAcquisitionContractV1() as Record<string, unknown>;
      const drc = contract['dryRunContract'] as Record<string, unknown>;
      expect(drc['dbWriteAllowed']).toBe(false);
    });
  });

  describe('validateP26F32ContractCompleteness', () => {
    it('passes on valid contract', () => {
      const contract = buildP26F32ManualSourceAcquisitionContractV1() as Record<string, unknown>;
      const result = validateP26F32ContractCompleteness(contract);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    it('fails if missing required field', () => {
      const contract = { version: 'v1' } as Record<string, unknown>;
      const result = validateP26F32ContractCompleteness(contract);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
    it('fails if dbWriteAllowed is not false', () => {
      const contract = buildP26F32ManualSourceAcquisitionContractV1() as Record<string, unknown>;
      (contract['dryRunContract'] as Record<string, unknown>)['dbWriteAllowed'] = true;
      const result = validateP26F32ContractCompleteness(contract);
      expect(result.valid).toBe(false);
    });
  });

  describe('Helper functions', () => {
    it('isP26F32PeriodInTargetRange accepts valid period', () => {
      expect(isP26F32PeriodInTargetRange('2025-09')).toBe(true);
    });
    it('isP26F32PeriodInTargetRange rejects invalid period', () => {
      expect(isP26F32PeriodInTargetRange('2025-08')).toBe(false);
    });
    it('isP26F32SymbolInTargetSet accepts valid symbol', () => {
      expect(isP26F32SymbolInTargetSet('2330')).toBe(true);
    });
    it('isP26F32SymbolInTargetSet rejects invalid symbol', () => {
      expect(isP26F32SymbolInTargetSet('9999')).toBe(false);
    });
    it('isP26F32FormatAccepted accepts csv', () => {
      expect(isP26F32FormatAccepted('csv')).toBe(true);
    });
    it('isP26F32FormatAccepted rejects xlsx', () => {
      expect(isP26F32FormatAccepted('xlsx')).toBe(false);
    });
    it('isP26F32SourceNameAllowed accepts TWSE', () => {
      expect(isP26F32SourceNameAllowed('TWSE')).toBe(true);
    });
    it('isP26F32SourceNameAllowed rejects UNKNOWN', () => {
      expect(isP26F32SourceNameAllowed('UNKNOWN')).toBe(false);
    });
    it('detectP26F32ForbiddenFields detects outcomePrice', () => {
      const row = { stockId: '2330', outcomePrice: 100 } as Record<string, unknown>;
      const found = detectP26F32ForbiddenFields(row);
      expect(found).toContain('outcomePrice');
    });
    it('detectP26F32ForbiddenFields returns empty for clean row', () => {
      const row = { stockId: '2330', revenue: 1000 } as Record<string, unknown>;
      const found = detectP26F32ForbiddenFields(row);
      expect(found).toHaveLength(0);
    });
  });

  describe('No forbidden implementation patterns', () => {
    it('source file does not use Math.random()', () => {
      const fs = require('fs');
      const src = fs.readFileSync(require('path').join(__dirname, '../P26F32ManualSourceAcquisitionContractUtils.ts'), 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });
    it('source file does not use external imports', () => {
      const fs = require('fs');
      const src = fs.readFileSync(require('path').join(__dirname, '../P26F32ManualSourceAcquisitionContractUtils.ts'), 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
  });
});
