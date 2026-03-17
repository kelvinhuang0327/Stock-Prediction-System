import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { HotStocksList } from "@/components/dashboard/HotStocksList";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { SectorPerformance } from "@/components/dashboard/SectorPerformance";
import { MarketBreadth } from "@/components/dashboard/MarketBreadth";
import { SmartScreener } from "@/components/dashboard/SmartScreener";
import { HybridPrediction } from "@/components/analysis/HybridPrediction";
import { BacktestStats } from "@/components/analysis/BacktestStats";

export default function Home() {
  return (
    <div className="space-y-8">
      {/* 1. Market Overview at Top */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          📊 臺股市場概況 (Market Overview)
        </h2>
        <MarketOverview />
      </section>

      {/* 2. Hero Action: Asset Doubling */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-800 p-8 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01]">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">🚀 資產翻倍計劃 (Asset Doubling)</h2>
          <p className="max-w-xl text-red-100 text-lg mb-6">
            專為高成長潛力股設計的 AI 篩選引擎。結合營收動能、籌碼優勢與技術型態，尋找下一檔翻倍飆股。
          </p>
          <a
            href="/asset-doubling"
            className="inline-block bg-white text-red-700 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition-all transform hover:scale-105 shadow-lg"
          >
            立即查看 AI 智選標的 →
          </a>
        </div>
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-400 rounded-full blur-2xl opacity-20" />
      </section>

      {/* 3. Hot Stocks */}
      <section>
        <h2 className="text-2xl font-bold mb-4">🔥 今日熱門股</h2>
        <HotStocksList />
      </section>

      {/* 4. Sector Performance */}
      <section>
        <h2 className="text-2xl font-bold mb-4">📈 類股表現</h2>
        <SectorPerformance />
      </section>

      {/* 5. Smart Screener */}
      <section>
        <h2 className="text-2xl font-bold mb-4">🎯 智能選股</h2>
        <SmartScreener />
      </section>

      {/* 6. Market Breadth */}
      <section>
        <h2 className="text-2xl font-bold mb-4">📊 市場廣度</h2>
        <MarketBreadth />
      </section>

      {/* 7. News Feed */}
      <section>
        <h2 className="text-2xl font-bold mb-4">📰 即時新聞</h2>
        <NewsFeed />
      </section>
    </div>
  );
}
