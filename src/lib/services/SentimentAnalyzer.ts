export class SentimentAnalyzer {
    // Basic dictionary for MVP (Traditional Chinese)
    private positiveKeywords = [
        '利多', '上漲', '突破', '新高', '成長', '優於預期', '買進', '看好',
        '旺季', '獲利', '營收創新高', '大漲', '暴漲', '復甦', '加碼'
    ];

    private negativeKeywords = [
        '利空', '下跌', '跌破', '新低', '衰退', '不如預期', '賣出', '看淡',
        '淡季', '虧損', '營收下滑', '大跌', '崩盤', '衰退', '減碼'
    ];

    /**
     * Analyze sentiment of a text string
     * Returns a score between -1.0 (Negative) and 1.0 (Positive)
     */
    analyze(text: string): { score: number; keywords: string[] } {
        let score = 0;
        const foundKeywords: string[] = [];

        // Normalize
        const content = text.toLowerCase();

        // Check Positive
        this.positiveKeywords.forEach(word => {
            if (content.includes(word)) {
                score += 1;
                foundKeywords.push(word);
            }
        });

        // Check Negative
        this.negativeKeywords.forEach(word => {
            if (content.includes(word)) {
                score -= 1;
                foundKeywords.push(word);
            }
        });

        // Normalize score to -1 to 1 range based on density? 
        // For MVP, just clamp it.
        const clampedScore = Math.max(-1, Math.min(1, score * 0.5)); // Accumulate up to 2 points to get max

        return {
            score: clampedScore,
            keywords: foundKeywords
        };
    }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
