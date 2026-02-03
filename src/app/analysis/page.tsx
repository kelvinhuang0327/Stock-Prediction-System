import React from 'react';
import { AIAdvice } from '@/components/analysis/AIAdvice';
import { SectorRotationMap } from '@/components/analysis/SectorRotationMap';
import { SentimentAnalysis } from '@/components/analysis/SentimentAnalysis';

export default function AnalysisPage() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">AI Market Analysis</h1>
                <p className="text-muted-foreground">
                    Deep learning powered insights for the Taiwan Stock Market.
                </p>
            </div>

            <AIAdvice />

            <div className="grid grid-cols-1 gap-6">
                <SectorRotationMap />
                <SentimentAnalysis />
            </div>
        </div>
    );
}
