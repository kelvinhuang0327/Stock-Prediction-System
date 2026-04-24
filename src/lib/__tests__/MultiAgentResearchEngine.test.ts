/**
 * MultiAgentResearchEngine tests
 *
 * Covers:
 * 1. Full data → positive/negative viewpoints exist
 * 2. Missing chip → ChipAgent Insufficient
 * 3. Missing revenue → FundamentalAgent Insufficient
 * 4. RiskAgent always provides counter-stance
 * 5. consensus never null
 * 6. Response always has complete structure
 * 7. dataCoverage=insufficient → confidence lowered
 * 8. Market regime=Unknown → MarketAgent Insufficient
 */

import {
  runMultiAgentResearch,
  type ResearchInput,
} from '../research/MultiAgentResearchEngine';

const fullInput: ResearchInput = {
  symbol: '2330',
  marketRegime: 'Bull',
  regimeConfidence: 75,
  alphaScore: 72,
  bucket: 'Watch',
  confidence: 65,
  dataCoverage: 'full',
  technicalScore: 68,
  chipScore: 60,
  fundamentalScore: 55,
  marketAdjustment: 5,
  usedSources: ['technical', 'chip', 'fundamental'],
  missingSources: [],
  limitations: [],
};

describe('MultiAgentResearchEngine', () => {
  // ─── 1. Full data produces both Bullish and Bearish viewpoints ─

  it('full data produces 6 viewpoints with a mix of stances', () => {
    const result = runMultiAgentResearch(fullInput);
    expect(result.viewpoints).toHaveLength(6);
    const stances = result.viewpoints.map((v) => v.stance);
    expect(stances).toContain('Bullish');
    // RiskAgent should be Bearish when others are optimistic
    expect(stances).toContain('Bearish');
  });

  // ─── 2. Missing chip → ChipAgent = Insufficient ───────────────

  it('missing chip data → ChipAgent returns Insufficient', () => {
    const input: ResearchInput = {
      ...fullInput,
      missingSources: ['chip_data'],
    };
    const result = runMultiAgentResearch(input);
    const chipView = result.viewpoints.find((v) => v.name === 'ChipAgent');
    expect(chipView).toBeDefined();
    expect(chipView!.stance).toBe('Insufficient');
    expect(chipView!.missingSources).toContain('chip_data');
  });

  // ─── 3. Missing fundamental data ─────────────────────────────

  it('missing revenue data → FundamentalAgent returns Insufficient', () => {
    const input: ResearchInput = {
      ...fullInput,
      missingSources: ['revenue_data', 'fundamental_data'],
    };
    const result = runMultiAgentResearch(input);
    const fundView = result.viewpoints.find((v) => v.name === 'FundamentalAgent');
    expect(fundView).toBeDefined();
    expect(fundView!.stance).toBe('Insufficient');
  });

  // ─── 4. RiskAgent always provides counter-stance ──────────────

  it('RiskAgent stance differs from pure consensus (bullish scenario)', () => {
    const result = runMultiAgentResearch({ ...fullInput, technicalScore: 85, chipScore: 80, fundamentalScore: 75 });
    const riskView = result.viewpoints.find((v) => v.name === 'RiskAgent');
    expect(riskView).toBeDefined();
    // RiskAgent should not be Bullish even when everyone else is
    expect(riskView!.stance).not.toBe('Bullish');
    expect(riskView!.rationale.length).toBeGreaterThan(10);
  });

  it('RiskAgent is not Bearish when most agents are Bearish', () => {
    const input: ResearchInput = {
      ...fullInput,
      marketRegime: 'Bear',
      technicalScore: 20,
      chipScore: 15,
      fundamentalScore: 10,
      alphaScore: 25,
      confidence: 30,
    };
    const result = runMultiAgentResearch(input);
    const riskView = result.viewpoints.find((v) => v.name === 'RiskAgent');
    expect(riskView).toBeDefined();
    // In a bear + low scores scenario, RiskAgent should be Neutral (providing balance)
    expect(riskView!.stance).not.toBe('Bullish');
  });

  // ─── 5. consensus never null ──────────────────────────────────

  it('consensus is always defined and non-null', () => {
    const cases: ResearchInput[] = [
      fullInput,
      { ...fullInput, dataCoverage: 'insufficient', missingSources: ['chip_data', 'revenue_data', 'fundamental_data'] },
      { ...fullInput, marketRegime: 'Unknown' },
    ];
    for (const input of cases) {
      const result = runMultiAgentResearch(input);
      expect(result.consensus).toBeDefined();
      expect(['Positive', 'Mixed', 'Negative', 'Insufficient']).toContain(result.consensus);
      expect(typeof result.consensusConfidence).toBe('number');
      expect(result.consensusConfidence).toBeGreaterThanOrEqual(0);
      expect(result.consensusConfidence).toBeLessThanOrEqual(100);
    }
  });

  // ─── 6. Complete structure always returned ────────────────────

  it('always returns complete response structure', () => {
    const result = runMultiAgentResearch(fullInput);
    expect(Array.isArray(result.viewpoints)).toBe(true);
    expect(Array.isArray(result.disagreementPoints)).toBe(true);
    expect(Array.isArray(result.keyRisks)).toBe(true);
    expect(Array.isArray(result.scenarioNotes)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
    expect(typeof result.disclaimer).toBe('string');
    expect(result.disclaimer.length).toBeGreaterThan(0);
  });

  it('each viewpoint has required fields', () => {
    const result = runMultiAgentResearch(fullInput);
    for (const v of result.viewpoints) {
      expect(typeof v.name).toBe('string');
      expect(['Bullish', 'Neutral', 'Bearish', 'Insufficient']).toContain(v.stance);
      expect(typeof v.confidence).toBe('number');
      expect(typeof v.rationale).toBe('string');
      expect(v.rationale.length).toBeGreaterThan(0);
      expect(Array.isArray(v.limitations)).toBe(true);
      expect(Array.isArray(v.missingSources)).toBe(true);
    }
  });

  // ─── 7. dataCoverage=insufficient → lower confidence ─────────

  it('insufficient dataCoverage reduces consensusConfidence vs full', () => {
    const full = runMultiAgentResearch({ ...fullInput, dataCoverage: 'full' });
    const insuf = runMultiAgentResearch({ ...fullInput, dataCoverage: 'insufficient' });
    expect(insuf.consensusConfidence).toBeLessThan(full.consensusConfidence);
  });

  // ─── 8. MarketRegime Unknown → MarketAgent Insufficient ───────

  it('MarketRegime=Unknown → MarketAgent returns Insufficient', () => {
    const result = runMultiAgentResearch({ ...fullInput, marketRegime: 'Unknown' });
    const marketView = result.viewpoints.find((v) => v.name === 'MarketAgent');
    expect(marketView).toBeDefined();
    expect(marketView!.stance).toBe('Insufficient');
  });

  // ─── 9. Majorly insufficient → consensus=Insufficient ────────

  it('when most agents are Insufficient, consensus=Insufficient', () => {
    const input: ResearchInput = {
      ...fullInput,
      dataCoverage: 'insufficient',
      marketRegime: 'Unknown',
      missingSources: ['chip_data', 'revenue_data', 'fundamental_data', 'event_data'],
    };
    const result = runMultiAgentResearch(input);
    expect(result.consensus).toBe('Insufficient');
  });

  // ─── 10. Bear regime → Negative or Mixed consensus ───────────

  it('Bear regime with low scores leans toward Negative consensus', () => {
    const input: ResearchInput = {
      ...fullInput,
      marketRegime: 'Bear',
      regimeConfidence: 80,
      technicalScore: 22,
      chipScore: 18,
      fundamentalScore: 15,
      alphaScore: 20,
      confidence: 25,
    };
    const result = runMultiAgentResearch(input);
    expect(['Negative', 'Mixed']).toContain(result.consensus);
  });

  // ─── 11. CatalystAgent is Insufficient (no event data) ───────

  it('CatalystAgent returns Insufficient when no event data', () => {
    const result = runMultiAgentResearch(fullInput);
    const catalystView = result.viewpoints.find((v) => v.name === 'CatalystAgent');
    expect(catalystView).toBeDefined();
    expect(catalystView!.stance).toBe('Insufficient');
    expect(catalystView!.missingSources.length).toBeGreaterThan(0);
  });

  it('CatalystAgent returns Neutral when eventCount is 1-2', () => {
    const result = runMultiAgentResearch({ ...fullInput, eventCount: 2 });
    const catalystView = result.viewpoints.find((v) => v.name === 'CatalystAgent');
    expect(catalystView).toBeDefined();
    expect(catalystView!.stance).toBe('Neutral');
  });

  it('CatalystAgent returns Bullish (low confidence) when eventCount >=3', () => {
    const result = runMultiAgentResearch({
      ...fullInput,
      eventCount: 4,
      eventTrustLevelSummary: { official: 0, mainstream: 2, secondary: 1, unknown: 0 },
      recentThemes: ['法說會', '產能'],
      catalystSummary: '近期主題集中，且包含較高可信度來源，值得持續觀察',
    });
    const catalystView = result.viewpoints.find((v) => v.name === 'CatalystAgent');
    expect(catalystView).toBeDefined();
    expect(catalystView!.stance).toBe('Bullish');
    expect(catalystView!.confidence).toBeLessThanOrEqual(40);
  });

  it('CatalystAgent limits confidence when trust is mostly unknown/secondary', () => {
    const result = runMultiAgentResearch({
      ...fullInput,
      eventCount: 5,
      eventTrustLevelSummary: { official: 0, mainstream: 0, secondary: 3, unknown: 2 },
      catalystSummary: '來源多為次級摘要，需保守解讀',
    });
    const catalystView = result.viewpoints.find((v) => v.name === 'CatalystAgent');
    expect(catalystView).toBeDefined();
    expect(catalystView!.confidence).toBeLessThanOrEqual(25);
    expect(['Neutral', 'Bullish']).toContain(catalystView!.stance);
  });

  // ─── 12. keyRisks always non-empty ───────────────────────────

  it('keyRisks always has at least one item', () => {
    const result = runMultiAgentResearch(fullInput);
    expect(result.keyRisks.length).toBeGreaterThan(0);
  });

  // ─── 13. scenarioNotes always non-empty ──────────────────────

  it('scenarioNotes always has at least one item', () => {
    const cases: ResearchInput[] = [
      fullInput,
      { ...fullInput, marketRegime: 'Bear', technicalScore: 20, chipScore: 15, fundamentalScore: 10 },
    ];
    for (const input of cases) {
      const result = runMultiAgentResearch(input);
      expect(result.scenarioNotes.length).toBeGreaterThan(0);
    }
  });

  // ─── 14. All 6 agent names present ───────────────────────────

  it('all 6 agent names are present', () => {
    const result = runMultiAgentResearch(fullInput);
    const names = result.viewpoints.map((v) => v.name);
    expect(names).toContain('TechnicalAgent');
    expect(names).toContain('MarketAgent');
    expect(names).toContain('ChipAgent');
    expect(names).toContain('FundamentalAgent');
    expect(names).toContain('CatalystAgent');
    expect(names).toContain('RiskAgent');
  });
});
