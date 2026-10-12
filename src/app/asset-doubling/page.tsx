import React from 'react';
import { AssetDoublingPlan } from '@/components/plan/AssetDoublingPlan';
import { ExpertJuryPanel } from '@/components/analysis/ExpertJuryPanel';

export default function AssetDoublingPage() {
    return (
        <div className="container mx-auto px-4 py-8 space-y-12">
            <ExpertJuryPanel />
            <div className="h-px bg-slate-800 w-full" />
            <AssetDoublingPlan />
        </div>
    );
}
