
import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    Sword,
    Target,
    Ban,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Eye,
    Brain,
    Gamepad2 // For Simulation Icon
} from 'lucide-react';
import { ScreeningResult } from '@/lib/services/StrategyScreeningService';
import { ProTraderSimulation } from './ProTraderSimulation';

interface MarketStatus {
    status: string;
    scalingFactor: number;
    indexClose: number;
    regime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR';
    ma20?: number;
}

interface ProTraderProps {
    marketStatus: MarketStatus | null;
    candidates: ScreeningResult[];
    onClose?: () => void;
}

type TradePhase = 'RECON' | 'EXPANSION' | 'HARVEST' | 'DEFENSE';
type TradeStyle = 'SHORT' | 'SWING' | 'TREND';

export function ProTraderDashboard({ marketStatus, candidates, onClose }: ProTraderProps) {
    // User Inputs
    const [capital, setCapital] = useState<number>(1000000); // Default 1M
    const [duration, setDuration] = useState<string>('3個月');
    const [maxDrawdown, setMaxDrawdown] = useState<number>(10); // 10%
    const [style, setStyle] = useState<TradeStyle>('TREND');

    // Analysis State
    const [phase, setPhase] = useState<TradePhase>('RECON');
    const [isTradeable, setIsTradeable] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'LIVE' | 'SIMULATION'>('LIVE');

    // Derived Logic
    useEffect(() => {
        if (!marketStatus) return;

        const regime = marketStatus.regime || 'NEUTRAL';
        const qualityCandidates = candidates.filter(c => c.technicalScore > 70 && c.chipStrength > 50).length;

        // 1. Determine Tradeability and Phase
        if (regime === 'BEAR' && qualityCandidates === 0) {
            setIsTradeable(false);
            setPhase('DEFENSE');
        } else if (regime === 'CORRECTION') {
            setIsTradeable(false); // Pro traders don't catch falling knives usually, or trade very lightly
            if (qualityCandidates > 2) {
                setIsTradeable(true);
                setPhase('RECON'); // Tentative
            } else {
                setPhase('DEFENSE');
            }
        } else if (regime === 'NEUTRAL') {
            setIsTradeable(true);
            setPhase('RECON');
        } else if (regime === 'BULL') {
            setIsTradeable(true);
            if (qualityCandidates >= 3) {
                setPhase('EXPANSION');
            } else {
                setPhase('RECON'); // Bull but no good stocks? Caution.
            }
        }

        // Harvest Check: If market is overextended (e.g. huge scaling factor but starting to turn?)
        // For now, simple regime mapping is safer.

    }, [marketStatus, candidates]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(val);
    };

    const getAllocationAdvice = () => {
        if (!isTradeable) return { percent: 0, text: '空手 / 現金為王', allowPyramid: false };

        switch (phase) {
            case 'DEFENSE': return { percent: 0, text: '0% (完全退場)', allowPyramid: false };
            case 'RECON': return { percent: 20, text: '20% - 30% (試單)', allowPyramid: false };
            case 'EXPANSION':
                const scale = marketStatus?.scalingFactor || 1;
                return { percent: Math.min(100, 70 * scale), text: `${Math.round(Math.min(100, 70 * scale))}% - 100% (積極進攻)`, allowPyramid: true };
            case 'HARVEST': return { percent: 40, text: '40% (逐步獲利了結)', allowPyramid: false };
            default: return { percent: 0, text: '暫停交易', allowPyramid: false };
        }
    };

    const allocation = getAllocationAdvice();
    const positionSize = (capital * (allocation.percent / 100));

    return (
        <div className="bg-slate-900 text-slate-50 p-6 rounded-2xl shadow-2xl border border-slate-700 font-sans">
            {/* Header / Config */}
            <div className="border-b border-slate-700 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-600 rounded-lg shadow-lg shadow-red-900/20">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            PRO TRADER COMMAND
                            <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded border border-red-600/30">ALPHA MODE</span>
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">紀律執刑系統 / 資金擴張策略</p>
                        <p className="text-amber-400/70 text-[10px] mt-0.5">⚠️ 模擬結果不含交易成本與滑價，過去表現不保證未來報酬，僅供研究參考</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                    <div className="flex flex-col px-3 py-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">初始資金</label>
                        <input
                            type="number"
                            value={capital}
                            onChange={(e) => setCapital(Number(e.target.value))}
                            className="bg-transparent border-none text-sm font-bold p-0 focus:ring-0 w-24 text-red-400"
                        />
                    </div>
                    <div className="flex flex-col px-3 py-1 border-l border-slate-700">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">最大回撤</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={maxDrawdown}
                                onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                                className="bg-transparent border-none text-sm font-bold p-0 focus:ring-0 w-8"
                            />
                            <span className="text-xs text-slate-400">%</span>
                        </div>
                    </div>
                    <div className="flex flex-col px-3 py-1 border-l border-slate-700">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">風格</label>
                        <select
                            value={style}
                            onChange={(e) => setStyle(e.target.value as TradeStyle)}
                            className="bg-transparent border-none text-sm font-bold p-0 focus:ring-0 text-slate-300"
                        >
                            <option value="SHORT">短線</option>
                            <option value="SWING">波段</option>
                            <option value="TREND">趨勢</option>
                        </select>
                    </div>
                    <div className="flex flex-col px-3 py-1 border-l border-slate-700">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">狀態</label>
                        <span className={`text-sm font-bold ${isTradeable ? 'text-green-400' : 'text-slate-500'}`}>
                            {isTradeable ? 'ACTIVE' : 'STANDBY'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex bg-slate-800 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('LIVE')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'LIVE' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    實戰監控 (Live Command)
                </button>
                <button
                    onClick={() => setActiveTab('SIMULATION')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'SIMULATION' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <Gamepad2 className="w-3 h-3" />
                    戰略推演 (War Room)
                </button>
            </div>

            {
                activeTab === 'SIMULATION' ? (
                    <ProTraderSimulation capital={capital} maxDrawdown={maxDrawdown} style={style} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                        {/* 1. Decision Matrix (Left Col) */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className={`p-6 rounded-xl border-2 transition-all ${isTradeable
                                ? 'bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/50'
                                : 'bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/50'
                                }`}>
                                <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">1. 市場判讀 (Market Check)</div>
                                <div className="flex items-center gap-3 mb-4">
                                    {isTradeable ? <Sword className="w-8 h-8 text-green-500" /> : <Ban className="w-8 h-8 text-red-500" />}
                                    <div>
                                        <h3 className={`text-2xl font-black ${isTradeable ? 'text-green-400' : 'text-red-400'}`}>
                                            {isTradeable ? '准許進攻' : '禁止交易'}
                                        </h3>
                                        <p className="text-xs text-slate-300">
                                            {isTradeable
                                                ? `市場處於 ${marketStatus?.regime}，且有 ${candidates.length} 檔高分標的。`
                                                : `市場風險過高 (${marketStatus?.regime}) 或缺乏優質標的。`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">2. 戰術階段 (Tactical Phase)</div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-3xl font-black tracking-tight text-white">{
                                        phase === 'RECON' ? '偵查 (Recon)' :
                                            phase === 'EXPANSION' ? '擴張 (Match)' :
                                                phase === 'HARVEST' ? '收割 (Harvest)' : '防禦 (Defense)'
                                    }</span>
                                    <Eye className="w-6 h-6 text-slate-400" />
                                </div>
                                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all ${phase === 'RECON' ? 'w-1/4 bg-yellow-500' :
                                        phase === 'EXPANSION' ? 'w-full bg-green-500' :
                                            phase === 'HARVEST' ? 'w-3/4 bg-purple-500' : 'w-0'
                                        }`} />
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">3. 資金水位 (Allocation)</div>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-3xl font-black text-amber-400">{allocation.text.split(' ')[0]}</span>
                                    <span className="text-sm text-amber-400/80 font-bold">{allocation.text.split(' ').slice(1).join(' ')}</span>
                                </div>
                                <div className="text-sm text-slate-400 font-mono mt-2 pt-2 border-t border-slate-700 flex justify-between">
                                    <span>建議部位:</span>
                                    <span className="text-white font-bold">{formatCurrency(positionSize)}</span>
                                </div>
                                <div className="text-sm text-slate-400 font-mono flex justify-between mt-1">
                                    <span>加碼許可:</span>
                                    <span className={allocation.allowPyramid ? 'text-green-400' : 'text-red-400'}>
                                        {allocation.allowPyramid ? 'YES (金字塔式)' : 'NO (絕對禁止)'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Strategy Rules (Right Col - Main Content) */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* 4. Do's and Don'ts */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
                                    <h4 className="font-bold flex items-center gap-2">
                                        <Target className="w-5 h-5 text-blue-400" />
                                        4. 戰略指導 (Directives)
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700">
                                    <div className="p-5 bg-green-900/5">
                                        <div className="text-green-400 font-bold text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" /> 該做什麼 (Execute)
                                        </div>
                                        <ul className="space-y-3 text-sm text-slate-300">
                                            {phase === 'EXPANSION' && (
                                                <>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 買進創新高且量能爆發的強勢股</li>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 獲利單每脫離成本 10% 進行加碼</li>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 汰弱留強，將資金移往最強標的</li>
                                                </>
                                            )}
                                            {phase === 'RECON' && (
                                                <>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 小量試單 (總資金 10% 內)</li>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 測試市場對利多的反應</li>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 嚴設今日低點為停損</li>
                                                </>
                                            )}
                                            {(phase === 'DEFENSE' || phase === 'HARVEST') && (
                                                <>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 現金為王，耐心等待恐慌低點</li>
                                                    <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span> 檢討過往交易紀錄</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                    <div className="p-5 bg-red-900/5">
                                        <div className="text-red-400 font-bold text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <Ban className="w-4 h-4" /> 絕對禁止 (Forbidden)
                                        </div>
                                        <ul className="space-y-3 text-sm text-slate-300">
                                            <li className="flex gap-2"><span className="text-red-500 font-bold">✕</span> <span className="text-white font-bold">向下攤平 (Averaging Down)</span></li>
                                            <li className="flex gap-2"><span className="text-red-500 font-bold">✕</span> 憑感覺抄底 (無訊號進場)</li>
                                            <li className="flex gap-2"><span className="text-red-500 font-bold">✕</span> 虧損部位加碼</li>
                                            {style === 'TREND' && <li className="flex gap-2"><span className="text-red-500 font-bold">✕</span> 過早獲利了結 (截斷利潤)</li>}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Stop Loss / Profit */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-red-400">
                                        <ShieldAlert className="w-5 h-5" />
                                        5. 強制停損 (Stop Rules)
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">單筆最大虧損</div>
                                            <div className="text-lg font-bold text-white">{(capital * 0.02).toLocaleString()} TWD <span className="text-xs text-slate-400 font-normal">(總資金 2%)</span></div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">技術停損位</div>
                                            <div className="text-sm text-slate-300">
                                                {style === 'SHORT' ? '跌破進場當日低點 或 -3%' :
                                                    style === 'SWING' ? '跌破 MA20 或 -7%' :
                                                        '週線跌破趨勢線 或 -10%'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-green-400">
                                        <Target className="w-5 h-5" />
                                        6. 退場機制 (Exit/Retreat)
                                    </h4>
                                    <div className="space-y-4">
                                        <ul className="space-y-2 text-sm text-slate-300">
                                            <li className="flex gap-2 items-start">
                                                <span className="text-amber-500 font-bold mt-1">!</span>
                                                <span>連續 <span className="text-white font-bold">2 筆</span> 虧損時，強制停止交易 3 天。</span>
                                            </li>
                                            <li className="flex gap-2 items-start">
                                                <span className="text-amber-500 font-bold mt-1">!</span>
                                                <span>總資金回撤達 <span className="text-red-400 font-bold">{maxDrawdown}%</span> 時，清空所有部位，重新檢視策略。</span>
                                            </li>
                                            <li className="flex gap-2 items-start">
                                                <span className="text-green-500 font-bold mt-1">✓</span>
                                                <span>大賺 (獲利 {'>'} 20%) 後，將停損上移至 <span className="text-white font-bold">損益兩平點 (Breakeven)</span>。</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}
