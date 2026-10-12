export type SourceTrustLevel = 'official' | 'mainstream' | 'secondary' | 'unknown';

interface SourceRule {
  match: RegExp;
  level: SourceTrustLevel;
}

const SOURCE_RULES: SourceRule[] = [
  // Official / disclosure
  { match: /mops\.twse\.com\.tw|twse\.com\.tw|gov\.tw/i, level: 'official' },

  // Mainstream media / RSS
  { match: /yahoo|cnyes|moneydj|udn|ctee|chinatimes|ltn|setn|ettoday/i, level: 'mainstream' },

  // Aggregators
  { match: /news\.google|google\s*news/i, level: 'secondary' },

  // Secondary / aggregator
  { match: /mockeventsource|blog|forum|ptt|dcard/i, level: 'secondary' },
];

export function resolveSourceTrustLevel(source: string, rawUrl?: string): SourceTrustLevel {
  const target = `${source ?? ''} ${rawUrl ?? ''}`.trim();
  for (const rule of SOURCE_RULES) {
    if (rule.match.test(target)) return rule.level;
  }
  return 'unknown';
}

export function getSourceTrustPolicy() {
  return SOURCE_RULES.map((r) => ({ pattern: r.match.source, level: r.level }));
}
