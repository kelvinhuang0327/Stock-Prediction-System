/**
 * ResearchParameterVersioning — Phase H tests
 */

import { DEFAULT_PARAMETERS } from '../ResearchParameterVersioning';
import type { ResearchParameters } from '../ResearchParameterVersioning';

describe('ResearchParameterVersioning', () => {
  describe('DEFAULT_PARAMETERS', () => {
    it('has all required fields', () => {
      const params: ResearchParameters = DEFAULT_PARAMETERS;

      expect(params.minSampleStrong).toBe(30);
      expect(params.minSampleDegraded).toBe(10);
      expect(params.minRegimeSample).toBe(5);
      expect(params.minHalfSample).toBe(8);
      expect(params.hitRateStableThreshold).toBe(0.15);
      expect(params.hitRateUnstableThreshold).toBe(0.30);
      expect(params.unknownFragileThreshold).toBe(0.5);
      expect(params.dominantRegimeShare).toBe(0.80);
      expect(params.minSampleFragile).toBe(10);
      expect(params.positionSizingHigh).toBe(0.10);
      expect(params.positionSizingMid).toBe(0.06);
      expect(params.positionSizingLow).toBe(0.03);
    });

    it('matches current hardcoded values in the system', () => {
      // These match the constants in SignalEffectivenessEngine
      expect(DEFAULT_PARAMETERS.minSampleStrong).toBe(30);
      expect(DEFAULT_PARAMETERS.minSampleDegraded).toBe(10);

      // These match WalkForwardValidator
      expect(DEFAULT_PARAMETERS.minHalfSample).toBe(8);

      // These match RegimeStratifiedEngine
      expect(DEFAULT_PARAMETERS.unknownFragileThreshold).toBe(0.5);
      expect(DEFAULT_PARAMETERS.dominantRegimeShare).toBe(0.80);
      expect(DEFAULT_PARAMETERS.minSampleFragile).toBe(10);

      // These match DecisionLayerEngine baseSizingForConviction
      expect(DEFAULT_PARAMETERS.positionSizingHigh).toBe(0.10);
      expect(DEFAULT_PARAMETERS.positionSizingMid).toBe(0.06);
      expect(DEFAULT_PARAMETERS.positionSizingLow).toBe(0.03);
    });

    it('has serializable values (no NaN, Infinity)', () => {
      const json = JSON.stringify(DEFAULT_PARAMETERS);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(DEFAULT_PARAMETERS);
    });
  });
});
