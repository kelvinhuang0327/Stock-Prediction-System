
'use client';
import React from "react";
import type { StockStrategyResearchStaticFixture } from "../fixtures/StockStrategyResearchStaticFixture";

interface Props {
  fixture: StockStrategyResearchStaticFixture;
}

const REQUIRED_GOVERNANCE_FLAGS = {
  reviewOnly: true,
  noInvestmentAdvice: true,
  noForecast: true,
  noRecommendation: true,
  previewOnly: true,
  paperOnly: true,
  noExecution: true,
  noActualMetrics: true,
  entersAlphaScore: false,
  notInvestmentAdvice: true,
} as const;

export const StrategyResearchStaticView: React.FC<Props> = ({ fixture }) => (
  <main className="min-h-screen bg-gray-50 py-8 px-4">
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Governance Banner ──────────────────────────────── */}
      <header role="banner" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          策略研究頁（靜態樣本）
        </h1>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            靜態樣本資料
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
            研究用途
          </span>
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/10">
            非投資建議
          </span>
        </div>
        <section aria-label="disclaimer" className="border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 rounded-r-md">
          <p className="text-sm text-yellow-800">
            本頁僅供研究用途，非投資建議，不承諾回報，不提供買賣或持有操作指令，非真實交易系統，不可直接執行。
          </p>
        </section>
      </header>

      {/* ── Strategy Overview ──────────────────────────────── */}
      <section aria-label="Strategy Overview" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">策略概覽</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <dt className="text-sm font-medium text-gray-500">策略名稱</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.strategyName}</dd>
          <dt className="text-sm font-medium text-gray-500">版本</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.strategyVersion}</dd>
          <dt className="text-sm font-medium text-gray-500">狀態</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.strategyLifecycleStatus}</dd>
          <dt className="text-sm font-medium text-gray-500">驗證狀態</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.validationStatus}</dd>
          <dt className="text-sm font-medium text-gray-500">模擬區間</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.simulationWindow}</dd>
          <dt className="text-sm font-medium text-gray-500">驗證方法</dt>
          <dd className="text-sm text-gray-900">{fixture.strategyOverview.validationMethod}</dd>
        </dl>
      </section>

      {/* ── Data Source / PIT Metadata ─────────────────────── */}
      <section aria-label="Data Source / PIT Metadata" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">資料來源 / PIT Metadata</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <dt className="text-sm font-medium text-gray-500">Source ID</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.sourceId}</dd>
          <dt className="text-sm font-medium text-gray-500">As Of</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.asOf}</dd>
          <dt className="text-sm font-medium text-gray-500">Available At</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.availableAt}</dd>
          <dt className="text-sm font-medium text-gray-500">Published At</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.publishedAt}</dd>
          <dt className="text-sm font-medium text-gray-500">Release Date</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.releaseDate}</dd>
          <dt className="text-sm font-medium text-gray-500">PIT Validation</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.pitValidationStatus}</dd>
          <dt className="text-sm font-medium text-gray-500">Leakage Guard</dt>
          <dd className="text-sm text-gray-900">{fixture.dataSourcePitMetadata.leakageGuardStatus}</dd>
        </dl>
      </section>

      {/* ── Feature Inputs ─────────────────────────────────── */}
      <section aria-label="Feature Inputs" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">特徵輸入</h2>
        <div>
          <strong>Technical:</strong>
          <ul className="list-disc ml-6">
            {fixture.featureInputs.technicalFeatures.map((f) => (
              <li key={f.name}>{f.name} ({f.description})</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Fundamental:</strong>
          <ul className="list-disc ml-6">
            {fixture.featureInputs.fundamentalFeatures.map((f) => (
              <li key={f.name}>{f.name} ({f.description})</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>News/Event:</strong>
          <ul className="list-disc ml-6">
            {fixture.featureInputs.newsEventFeatures.map((f) => (
              <li key={f.name}>{f.name} ({f.description})</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Simulation / Validation Summary ───────────────── */}
      <section aria-label="Simulation / Validation Summary" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">模擬 / 驗證摘要</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <dt className="text-sm font-medium text-gray-500">Sample Period</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.samplePeriod}</dd>
          <dt className="text-sm font-medium text-gray-500">Train Period</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.trainPeriod}</dd>
          <dt className="text-sm font-medium text-gray-500">Validation Period</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.validationPeriod}</dd>
          <dt className="text-sm font-medium text-gray-500">Out-of-Sample Period</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.outOfSamplePeriod}</dd>
          <dt className="text-sm font-medium text-gray-500">Confidence Notes</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.confidenceNotes}</dd>
          <dt className="text-sm font-medium text-gray-500">Limitations</dt>
          <dd className="text-sm text-gray-900">{fixture.simulationValidationSummary.limitations}</dd>
        </dl>
      </section>

      {/* ── Strategy Comparison / Stability ──────────────── */}
      <section aria-label="Strategy Comparison / Stability" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">策略比較 / 穩定性</h2>
        <ul className="list-disc ml-6">
          {fixture.strategyComparisonStability.strategies.map((s) => (
            <li key={s.strategyId}>{s.name} (穩定性分數: {s.stabilityScore})</li>
          ))}
        </ul>
        <div className="mt-2 text-sm text-gray-700">{fixture.strategyComparisonStability.comparisonNotes}</div>
      </section>

      {/* ── Risk & Limitation Disclosure ─────────────────── */}
      <section aria-label="Risk & Limitation Disclosure" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">風險與限制揭露</h2>
        <div className="text-sm text-gray-700 mb-2">{fixture.riskLimitationDisclosure.riskDisclosure}</div>
        <div className="text-xs text-gray-500">{fixture.riskLimitationDisclosure.limitationNotes}</div>
      </section>

      {/* ── Audit Trail / Replay Trace ───────────────────── */}
      <section aria-label="Audit Trail / Replay Trace" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">審計軌跡 / 回放鏈結</h2>
        <ul className="list-disc ml-6">
          {fixture.auditTrailReplayTrace.auditTrail.map((a) => (
            <li key={a.event + '-' + a.timestamp}>{a.event} ({a.timestamp})</li>
          ))}
        </ul>
        <div className="mt-2">
          <strong>Replay Links:</strong>
          <ul className="list-disc ml-6">
            {fixture.auditTrailReplayTrace.replayLinks.map((l: string) => (
              <li key={l}><a href={l} className="text-blue-600 underline">{l}</a></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Governance Flags ─────────────────────────────── */}
      <section aria-label="governance-flags" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">治理標誌</h2>
        <ul className="space-y-1">
          {Object.entries(REQUIRED_GOVERNANCE_FLAGS).map(([flagKey, flagValue]) => {
            const badgeClass =
              flagValue === true
                ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20";
            return (
              <li
                key={flagKey}
                className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm font-mono text-gray-700">{flagKey}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                  {String(flagValue)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Footer note ─────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-400 pb-4">
        靜態樣本資料，僅供研究用途，非投資建議。
      </footer>
    </div>
  </main>
);
