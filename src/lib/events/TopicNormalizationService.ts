export interface TopicNormalizationResult {
  topics: string[];
  limitations: string[];
}

interface TopicRule {
  canonical: string;
  patterns: RegExp[];
}

const TOPIC_RULES: TopicRule[] = [
  { canonical: 'AI伺服器', patterns: [/\bai\s*server\b/i, /ai伺服器/i, /人工智慧伺服器/i] },
  { canonical: '高股息', patterns: [/高股息/i, /高息etf/i, /高股息etf/i] },
  { canonical: '半導體', patterns: [/半導體/i, /晶片/i, /\bchip(s)?\b/i] },
  { canonical: '電動車', patterns: [/電動車/i, /\bev\b/i] },
  { canonical: '伺服器', patterns: [/伺服器/i, /\bserver\b/i] },
  { canonical: '記憶體', patterns: [/記憶體/i, /\bdram\b/i, /\bnand\b/i] },
  { canonical: 'CPO', patterns: [/\bcpo\b/i, /矽光子/i, /光通訊/i] },
  { canonical: '機器人', patterns: [/機器人/i, /\brobot/i] },
  { canonical: '航運', patterns: [/航運/i, /貨櫃/i] },
];

const STOPWORDS = new Set([
  '市場',
  '公司',
  '消息',
  '新聞',
  '今日',
  '更新',
  '觀察',
  '事件',
  'stock',
  'news',
]);

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function canonicalizeTopic(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  for (const rule of TOPIC_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.canonical;
  }
  const normalized = normalizeToken(text);
  if (!normalized || STOPWORDS.has(normalized) || normalized.length < 2 || normalized.length > 20) return null;
  return text;
}

function tokenExtract(text: string): string[] {
  return text
    .split(/[\s,，。:：;；/\-()（）[\]【】]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20);
}

export function extractAndNormalizeTopics(input: {
  title?: string;
  summary?: string;
  relatedThemes?: string[];
}): TopicNormalizationResult {
  const limitations: string[] = [];
  const rawTopics = [
    ...(input.relatedThemes ?? []),
    ...tokenExtract(input.title ?? ''),
    ...tokenExtract(input.summary ?? ''),
  ];

  const normalized = new Set<string>();
  let uncertainCount = 0;
  for (const topic of rawTopics) {
    const canonical = canonicalizeTopic(topic);
    if (canonical) normalized.add(canonical);
    else uncertainCount++;
  }

  if (uncertainCount > 0) {
    limitations.push(`有 ${uncertainCount} 個主題詞未能可靠正規化，已保守保留/略過。`);
  }
  return { topics: [...normalized].slice(0, 10), limitations };
}

export const TopicNormalizationService = {
  extractAndNormalizeTopics,
};
