/**
 * DailyAlertEngine
 *
 * Research reminder layer — NOT a trading signal engine.
 * Produces conservative, explainable alerts based on real snapshot data.
 *
 * Rules:
 * - Change-based alerts (regime change, bucket upgrade, etc.) only generated
 *   when a previous DailyCandidateSnapshot / DailyMarketSnapshot exists.
 * - Status-based alerts (data quality, current risk) can always be generated.
 * - No alert is ever phrased as a buy/sell order.
 * - Severity is conservative: info / caution / warning only.
 */

import { prisma } from '@/lib/prisma';
import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { fuseBatch } from '@/lib/alpha/SignalFusionEngine';
import { APP_NAME } from '@/lib/config/app';

// ─── Public Types ─────────────────────────────────────────────────

export type AlertType =
  | 'market_regime_changed'
  | 'candidate_upgraded'
  | 'candidate_downgraded'
  | 'alpha_improved'
  | 'alpha_dropped'
  | 'watchlist_risk_escalated'
  | 'newly_insufficient_data'
  | 'data_quality_warning';

export type AlertSeverity = 'info' | 'caution' | 'warning';

export interface DailyAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  symbol?: string;           // if stock-specific
  previousValue?: string;    // for change alerts
  currentValue?: string;
  basis: string;             // where the data comes from
  comparisonBased: boolean;  // true = requires snapshot; false = status-only
}

export interface DailyAlertsResult {
  reportDate: string;
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  summary: string;
  overallSeverity: AlertSeverity;
  alerts: DailyAlert[];
  limitations: string[];
  generatedAt: string;
}

export interface AlertParams {
  includeWatchlist?: boolean;
  minSeverity?: AlertSeverity;
  maxItems?: number;
  includeDataWarnings?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────

const ALPHA_CHANGE_THRESHOLD = 5;
const BUCKET_ORDER: string[] = ['Excluded', 'Neutral', 'Watch', 'Strong Candidate'];
const RISK_ORDER = ['low', 'moderate', 'elevated', 'high'];

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, caution: 1, warning: 2 };

function bucketRank(b: string) { return BUCKET_ORDER.indexOf(b); }
function riskRank(r: string) { return RISK_ORDER.indexOf(r); }

// ─── Main Engine ──────────────────────────────────────────────────

export async function generateDailyAlerts(params?: AlertParams): Promise<DailyAlertsResult> {
  const today = new Date().toISOString().split('T')[0];
  const includeWatchlist = params?.includeWatchlist !== false;
  const includeDataWarnings = params?.includeDataWarnings !== false;
  const minSeverityRank = SEVERITY_RANK[params?.minSeverity ?? 'info'];
  const maxItems = params?.maxItems ?? 50;

  const limitations: string[] = [];
  const alerts: DailyAlert[] = [];

  // ── Find previous snapshot ──────────────────────────────────────
  const prevMarketSnap = await prisma.dailyMarketSnapshot.findFirst({
    where: { snapshotDate: { lt: today } },
    orderBy: { snapshotDate: 'desc' },
  }).catch(() => null);

  const comparisonAvailable = !!prevMarketSnap;
  const previousSnapshotDate = prevMarketSnap?.snapshotDate ?? null;

  let prevCandidateMap = new Map<string, { alphaScore: number; screenBucket: string }>();
  let prevWatchlistMap = new Map<string, { alphaScore: number | null; riskLevel: string | null; recommendationBucket: string | null }>();

  if (comparisonAvailable && previousSnapshotDate) {
    const [prevCandRows, prevWLRows] = await Promise.all([
      prisma.dailyCandidateSnapshot.findMany({ where: { snapshotDate: previousSnapshotDate } }).catch(() => []),
      prisma.dailyWatchlistSnapshot.findMany({ where: { snapshotDate: previousSnapshotDate } }).catch(() => []),
    ]);
    prevCandidateMap = new Map(prevCandRows.map(r => [r.symbol, r]));
    prevWatchlistMap = new Map(prevWLRows.map(r => [r.symbol, r]));
  } else {
    limitations.push('無前日快照，升降級與分數變化提醒無法產生。');
  }

  // ── 1. Market regime alert (comparison-based) ───────────────────
  const regime = await detectRegime().catch(() => null);

  if (comparisonAvailable && regime && prevMarketSnap) {
    const prevRegime = prevMarketSnap.regime;
    const currRegime = regime.regime;

    if (prevRegime !== currRegime) {
      const severity = (currRegime === 'Bear' || prevRegime === 'Bull') ? 'warning'
        : (currRegime === 'Sideways' || currRegime === 'Unknown') ? 'caution'
        : 'info';

      alerts.push({
        type: 'market_regime_changed',
        severity,
        title: `市場環境轉變：${prevRegime} → ${currRegime}`,
        body: buildRegimeChangeBody(prevRegime, currRegime, regime.confidence),
        previousValue: prevRegime,
        currentValue: currRegime,
        basis: 'DailyMarketSnapshot + MarketRegimeEngine',
        comparisonBased: true,
      });
    }
  }

  // ── 2. Data quality warnings (status-based, always available) ──
  if (includeDataWarnings) {
    const [sqCount, icCount, miCount] = await Promise.all([
      prisma.stockQuote.count().catch(() => 0),
      prisma.institutionalChip.count().catch(() => 0),
      prisma.marketIndex.count().catch(() => 0),
    ]);

    if (sqCount === 0) {
      alerts.push({
        type: 'data_quality_warning',
        severity: 'warning',
        title: '個股行情資料缺失',
        body: '資料庫中無任何個股行情資料（StockQuote），所有評分準確度將大幅降低。建議執行資料同步。',
        basis: 'Database StockQuote count',
        comparisonBased: false,
      });
    } else if (icCount === 0) {
      alerts.push({
        type: 'data_quality_warning',
        severity: 'caution',
        title: '法人籌碼資料缺失',
        body: '法人籌碼（InstitutionalChip）資料不足，籌碼面分數將以降級模式估算，候選評分可信度下降。',
        basis: 'Database InstitutionalChip count',
        comparisonBased: false,
      });
    }

    if (miCount < 100) {
      alerts.push({
        type: 'data_quality_warning',
        severity: 'caution',
        title: '大盤指數歷史資料偏少',
        body: `大盤指數僅有 ${miCount} 筆，市場環境判斷可能不穩定，相關分析請保守解讀。`,
        basis: 'Database MarketIndex count',
        comparisonBased: false,
      });
    }
  }

  // ── 3. Candidate upgrade/downgrade (comparison-based) ──────────
  if (comparisonAvailable) {
    const screenResult = await runScreen({ maxResults: 200 }).catch(() => null);
    if (screenResult) {
      for (const c of screenResult.candidates) {
        const prev = prevCandidateMap.get(c.symbol);
        if (!prev) continue;

        const prevRank = bucketRank(prev.screenBucket);
        const currRank = bucketRank(c.screenBucket);
        const alphaDelta = c.alphaScore - prev.alphaScore;

        if (currRank > prevRank) {
          alerts.push({
            type: 'candidate_upgraded',
            severity: 'info',
            title: `${c.symbol} ${c.name} 候選分級升級`,
            body: `Bucket 由 ${prev.screenBucket} 升至 ${c.screenBucket}。Alpha: ${prev.alphaScore.toFixed(0)} → ${c.alphaScore.toFixed(0)}。${c.whyIncluded}`,
            symbol: c.symbol,
            previousValue: prev.screenBucket,
            currentValue: c.screenBucket,
            basis: 'DailyCandidateSnapshot + StrategyScreenEngine',
            comparisonBased: true,
          });
        } else if (currRank < prevRank) {
          const severity = (c.screenBucket === 'Excluded') ? 'caution' : 'info';
          alerts.push({
            type: 'candidate_downgraded',
            severity,
            title: `${c.symbol} ${c.name} 候選分級降低`,
            body: `Bucket 由 ${prev.screenBucket} 降至 ${c.screenBucket}。Alpha: ${prev.alphaScore.toFixed(0)} → ${c.alphaScore.toFixed(0)}。`,
            symbol: c.symbol,
            previousValue: prev.screenBucket,
            currentValue: c.screenBucket,
            basis: 'DailyCandidateSnapshot + StrategyScreenEngine',
            comparisonBased: true,
          });
        }

        if (alphaDelta >= ALPHA_CHANGE_THRESHOLD) {
          alerts.push({
            type: 'alpha_improved',
            severity: 'info',
            title: `${c.symbol} ${c.name} Alpha 分數改善 +${alphaDelta.toFixed(0)}`,
            body: `Alpha 由 ${prev.alphaScore.toFixed(0)} 升至 ${c.alphaScore.toFixed(0)}（+${alphaDelta.toFixed(0)}）。此為模型評分，非報酬保證。`,
            symbol: c.symbol,
            previousValue: prev.alphaScore.toFixed(0),
            currentValue: c.alphaScore.toFixed(0),
            basis: 'DailyCandidateSnapshot + SignalFusionEngine',
            comparisonBased: true,
          });
        } else if (alphaDelta <= -ALPHA_CHANGE_THRESHOLD) {
          alerts.push({
            type: 'alpha_dropped',
            severity: 'caution',
            title: `${c.symbol} ${c.name} Alpha 分數下滑 ${alphaDelta.toFixed(0)}`,
            body: `Alpha 由 ${prev.alphaScore.toFixed(0)} 降至 ${c.alphaScore.toFixed(0)}（${alphaDelta.toFixed(0)}）。`,
            symbol: c.symbol,
            previousValue: prev.alphaScore.toFixed(0),
            currentValue: c.alphaScore.toFixed(0),
            basis: 'DailyCandidateSnapshot + SignalFusionEngine',
            comparisonBased: true,
          });
        }

        // Newly insufficient data
        if (prev.screenBucket !== 'Excluded' && c.dataCoverage === 'insufficient') {
          alerts.push({
            type: 'newly_insufficient_data',
            severity: 'caution',
            title: `${c.symbol} ${c.name} 資料轉為不足`,
            body: `該股票今日已無足夠資料可進行評分（昨日為 ${prev.screenBucket}）。建議確認資料同步狀況。`,
            symbol: c.symbol,
            previousValue: prev.screenBucket,
            currentValue: 'insufficient',
            basis: 'DailyCandidateSnapshot + StrategyScreenEngine',
            comparisonBased: true,
          });
        }
      }
    } else {
      limitations.push('StrategyScreenEngine 無法執行，候選升降級提醒略過。');
    }
  }

  // ── 4. Watchlist risk escalation (comparison-based) ─────────────
  if (includeWatchlist && comparisonAvailable) {
    const watchlistItems = await prisma.watchlist.findMany({ include: { stock: true } }).catch(() => []);
    if (watchlistItems.length > 0) {
      const symbols = watchlistItems.map(w => w.stockId);
      const fusionResults = await fuseBatch(symbols).catch(() => []);
      const fusionMap = new Map(fusionResults.map(f => [f.symbol, f]));

      for (const item of watchlistItems) {
        const prev = prevWatchlistMap.get(item.stockId);
        const curr = fusionMap.get(item.stockId);
        if (!prev || !curr) continue;

        const currRisk = curr.alphaScore < 35 ? 'high'
          : curr.alphaScore < 55 ? 'moderate' : 'low';
        const prevRisk = prev.riskLevel ?? 'unknown';

        if (prevRisk !== 'unknown' && riskRank(currRisk) > riskRank(prevRisk)) {
          alerts.push({
            type: 'watchlist_risk_escalated',
            severity: 'warning',
            title: `自選標的 ${item.stockId} ${item.stock?.name ?? ''} 風險升高`,
            body: `風險等級由 ${prevRisk} 升至 ${currRisk}。Alpha: ${prev.alphaScore?.toFixed(0) ?? '?'} → ${curr.alphaScore.toFixed(0)}。建議留意，非交易建議。`,
            symbol: item.stockId,
            previousValue: prevRisk,
            currentValue: currRisk,
            basis: 'DailyWatchlistSnapshot + SignalFusionEngine',
            comparisonBased: true,
          });
        }

        // Newly insufficient
        if (prev.recommendationBucket !== 'Insufficient Data' && curr.recommendationBucket === 'Insufficient Data') {
          alerts.push({
            type: 'newly_insufficient_data',
            severity: 'caution',
            title: `自選標的 ${item.stockId} 資料轉為不足`,
            body: `${item.stock?.name ?? item.stockId} 今日資料不足以評分（昨日：${prev.recommendationBucket ?? '未知'}）。`,
            symbol: item.stockId,
            previousValue: prev.recommendationBucket ?? '?',
            currentValue: 'Insufficient Data',
            basis: 'DailyWatchlistSnapshot + SignalFusionEngine',
            comparisonBased: true,
          });
        }
      }
    }
  }

  // ── Filter & sort ──────────────────────────────────────────────
  const filtered = alerts
    .filter(a => SEVERITY_RANK[a.severity] >= minSeverityRank)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, maxItems);

  const overallSeverity = filtered.reduce<AlertSeverity>((max, a) =>
    SEVERITY_RANK[a.severity] > SEVERITY_RANK[max] ? a.severity : max,
    'info'
  );

  const summary = buildSummary(filtered, comparisonAvailable, regime?.regime ?? 'Unknown');

  return {
    reportDate: today,
    comparisonAvailable,
    previousSnapshotDate,
    summary,
    overallSeverity,
    alerts: filtered,
    limitations,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Summary Builder ──────────────────────────────────────────────

function buildSummary(alerts: DailyAlert[], comparisonAvailable: boolean, regime: string): string {
  if (!comparisonAvailable) {
    return '尚無前日快照，目前僅能提供資料狀態型提醒。請建立快照以啟用歷史比較提醒。';
  }
  if (alerts.length === 0) {
    return `今日未偵測到重大變化（市場環境：${regime}）。候選池與 watchlist 整體穩定。`;
  }

  const parts: string[] = [];
  const warnings = alerts.filter(a => a.severity === 'warning');
  const cautions = alerts.filter(a => a.severity === 'caution');
  const regimeAlert = alerts.find(a => a.type === 'market_regime_changed');
  const upgrades = alerts.filter(a => a.type === 'candidate_upgraded').length;
  const downgrades = alerts.filter(a => a.type === 'candidate_downgraded').length;
  const riskEsc = alerts.filter(a => a.type === 'watchlist_risk_escalated').length;
  const dataWarn = alerts.filter(a => a.type === 'data_quality_warning').length;

  if (regimeAlert) parts.push(`市場環境${regimeAlert.body.split('。')[0]}。`);
  if (upgrades > 0) parts.push(`${upgrades} 檔候選股 bucket 升級。`);
  if (downgrades > 0) parts.push(`${downgrades} 檔候選股 bucket 降級。`);
  if (riskEsc > 0) parts.push(`${riskEsc} 檔 watchlist 標的風險升高，建議留意。`);
  if (dataWarn > 0) parts.push(`${dataWarn} 項資料品質提醒，部分評分可信度有限。`);
  if (warnings.length === 0 && cautions.length === 0) parts.push('整體變化程度有限。');
  parts.push(`以上為 ${APP_NAME} 研究提醒，不構成任何投資建議。`);

  return parts.join('');
}

// ─── Regime Change Body ───────────────────────────────────────────

function buildRegimeChangeBody(prev: string, curr: string, confidence: number): string {
  const confLabel = confidence >= 70 ? '較高' : confidence >= 40 ? '中等' : '偏低';
  const tone = curr === 'Bear' ? '建議保守解讀所有訊號，注意風險管理。'
    : curr === 'Sideways' ? '震盪環境中突破訊號可信度降低，建議搭配量能觀察。'
    : curr === 'Bull' ? '偏多環境下趨勢型訊號相對有利，但個股風險仍需獨立評估。'
    : '環境不明，建議保守解讀所有分析結果。';
  return `市場環境由 ${prev} 轉為 ${curr}（信心度${confLabel}，${confidence}%）。${tone}`;
}
