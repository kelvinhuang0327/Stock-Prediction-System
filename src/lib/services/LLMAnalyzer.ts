import { AnalysisResult } from '@/types/prediction';

export class LLMAnalyzer {
    private provider: 'GEMINI' | 'OPENAI' | 'MOCK';
    private apiKey: string | undefined;

    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.provider = 'GEMINI';
            this.apiKey = process.env.GEMINI_API_KEY;
        } else if (process.env.OPENAI_API_KEY) {
            this.provider = 'OPENAI';
            this.apiKey = process.env.OPENAI_API_KEY;
        } else {
            this.provider = 'MOCK';
        }
    }

    /**
     * Analyze news using LLM or Advanced Heuristics
     */
    async analyzeNews(title: string, summary: string = ''): Promise<AnalysisResult> {
        if (this.provider === 'MOCK' || !this.apiKey) {
            return this.runHeuristic(title, summary);
        }

        try {
            // Future implementation for real LLM API calls
            // For now, even with key, we use heuristic as we don't have the SDK installed
            return this.runHeuristic(title, summary);
        } catch (error) {
            console.error('LLM Analysis failed, using heuristic fallback', error);
            return this.runHeuristic(title, summary);
        }
    }

    private runHeuristic(title: string, summary: string): AnalysisResult {
        const text = (title + ' ' + summary).toLowerCase();
        let score = 0;

        // Intensity markers
        const intensity = {
            very: 1.5,
            extremely: 2.0,
            slightly: 0.5,
            not: -1.0 // negation
        };

        // Advanced Patterns (Contextual)
        const patterns = [
            { regex: /營收(創|續)(新)?高/, weight: 1.0, label: 'High Revenue' },
            { regex: /股價(大)?漲/, weight: 0.8, label: 'Price Surge' },
            { regex: /獲利(創)?(下|新)?低/, weight: -1.2, label: 'Earnings Drop' },
            { regex: /調(升|高)評等/, weight: 1.1, label: 'Upgrade' },
            { regex: /調(降|低)評等/, weight: -1.1, label: 'Downgrade' },
            { regex: /接(單|獲).*(大|新)單/, weight: 1.2, label: 'New Contracts' },
            { regex: /產能(擴|滿)載/, weight: 0.9, label: 'Capacity Expansion' },
            { regex: /法說會.*(釋(出)?|表(示)?)?(利多|正向|看好)/, weight: 1.0, label: 'Bullish Briefing' },
            { regex: /法說會.*(釋(出)?|表(示)?)?(利空|保守|看淡)/, weight: -1.0, label: 'Bearish Briefing' },
        ];

        let explanation = 'Basic keyword analysis.';
        patterns.forEach(p => {
            if (p.regex.test(text)) {
                score += p.weight;
                explanation = `Detected: ${p.label}`;
            }
        });

        const finalScore = Math.max(-1, Math.min(1, score));

        return {
            sentiment: finalScore,
            explanation,
            suggestedAction: finalScore > 0.6 ? 'BUY' : (finalScore < -0.6 ? 'SELL' : 'HOLD')
        };
    }
}

export const llmAnalyzer = new LLMAnalyzer();
