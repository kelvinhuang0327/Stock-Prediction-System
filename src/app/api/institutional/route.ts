import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chipAnomalyScanner, ChipAnomalySignal } from '@/lib/scanners/ChipAnomalyScanner';

/**
 * GET /api/institutional
 * 主力控盤偵測 API
 * 
 * 僅使用 DB 真實籌碼資料。不使用 mock。
 * 若籌碼資料不足，回傳空陣列 + 資料狀態。
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const severityFilter = searchParams.get('severity') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        // Check chip data availability
        const chipCount = await (prisma as any).institutionalChip.count();
        const chipStocks = chipCount > 0
            ? await (prisma as any).institutionalChip.groupBy({ by: ['stockId'] })
            : [];

        if (chipStocks.length < 1) {
            return NextResponse.json({
                data: [],
                source: 'empty',
                methodology: '依據法人買賣超籌碼集中度變化偵測',
                disclaimer: '以下為模型推估結果，僅供參考。不代表實際主力身份或意圖。',
                coverage: {
                    stocksWithChipData: 0,
                    totalChipRows: 0,
                    minRequired: 20,
                    limitations: ['尚無法人買賣超資料，請先執行籌碼同步'],
                },
                updatedAt: new Date().toISOString(),
            });
        }

        const dbResults = await scanFromDB(severityFilter, limit);
        return NextResponse.json({
            data: dbResults || [],
            source: (dbResults && dbResults.length > 0) ? 'database（TWSE 法人買賣超資料）' : 'empty',
            methodology: '依據近 20 日法人籌碼集中度變化、投信連續買超天數、量價結構偵測',
            disclaimer: '以下為模型推估結果，僅供參考。不代表實際主力身份或意圖。',
            coverage: {
                stocksWithChipData: chipStocks.length,
                totalChipRows: chipCount,
                minRequired: 20,
                limitations: chipStocks.length < 20
                    ? [`僅 ${chipStocks.length} 檔股票有籌碼資料 (需 ≥20 天才可分析)`]
                    : [],
            },
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Institutional scan error:', error);
        return NextResponse.json({
            data: [],
            source: 'error',
            methodology: '',
            disclaimer: '',
            coverage: { stocksWithChipData: 0, totalChipRows: 0, minRequired: 20, limitations: ['資料庫查詢失敗'] },
            updatedAt: new Date().toISOString(),
        });
    }
}

async function scanFromDB(severityFilter: string, limit: number) {
    // Get all stocks that have chip data
    const stocks = await prisma.stock.findMany({
        select: { id: true, name: true, industry: true },
    });

    if (stocks.length === 0) return null;

    const allResults: InstitutionalScanResult[] = [];

    for (const stock of stocks) {
        const chips = await (prisma as any).institutionalChip.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'asc' },
            take: 60,
        });

        if (chips.length < 20) continue;

        const signals = await chipAnomalyScanner.scanStock(stock.id, chips);
        if (signals.length === 0) continue;

        const anomalyScore = chipAnomalyScanner.calculateAnomalyScore(signals);

        // Estimate phase based on signals
        const phase = estimatePhase(signals, chips);

        const latestQuote = await prisma.stockQuote.findFirst({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
        });

        const result: InstitutionalScanResult = {
            symbol: stock.id,
            name: stock.name,
            industry: stock.industry || '',
            price: latestQuote?.close ?? null,
            change: latestQuote?.change ?? null,
            volume: latestQuote?.volume ?? null,
            anomalyScore,
            phase: phase.label,
            phaseDescription: phase.description,
            signals: signals.map(s => ({
                type: s.anomalyType,
                severity: s.severity,
                score: s.score,
                reasoning: s.reasoning,
            })),
        };

        if (severityFilter) {
            const hasSeverity = signals.some(s => s.severity === severityFilter);
            if (!hasSeverity) continue;
        }

        allResults.push(result);
    }

    return allResults
        .sort((a, b) => b.anomalyScore - a.anomalyScore)
        .slice(0, limit);
}

interface InstitutionalScanResult {
    symbol: string;
    name: string;
    industry: string;
    price: number | null;
    change: number | null;
    volume: number | null;
    anomalyScore: number;
    phase: string;
    phaseDescription: string;
    signals: {
        type: string;
        severity: string;
        score: number;
        reasoning: string;
    }[];
}

function estimatePhase(signals: ChipAnomalySignal[], chips: any[]) {
    // Phase estimation based on chip patterns (model inference, not certainty)
    const hasConcentrationSurge = signals.some(s => s.anomalyType === 'CONCENTRATION_SURGE');
    const hasTrustAccumulation = signals.some(s => s.anomalyType === 'TRUST_ACCUMULATION');

    const recentNetBuy = chips.slice(-5).reduce((sum: number, c: any) => sum + (c.totalBuy || 0), 0);
    const olderNetBuy = chips.slice(-20, -5).reduce((sum: number, c: any) => sum + (c.totalBuy || 0), 0);

    if (hasConcentrationSurge && recentNetBuy > olderNetBuy * 2) {
        return {
            label: '可能拉抬期',
            description: '籌碼急速集中且近期買超力道遠超前期，推估可能處於拉抬階段。（模型推估）',
        };
    }
    if (hasTrustAccumulation && recentNetBuy > 0) {
        return {
            label: '可能佈局期',
            description: '投信持續買超，籌碼穩定集中，推估可能處於佈局階段。（模型推估）',
        };
    }
    if (recentNetBuy < 0 && hasConcentrationSurge) {
        return {
            label: '可能出貨期',
            description: '雖有籌碼集中信號但近期轉為賣超，推估可能處於出貨階段。（模型推估）',
        };
    }
    return {
        label: '觀察中',
        description: '尚無明確階段判定，建議持續觀察籌碼動態。',
    };
}
