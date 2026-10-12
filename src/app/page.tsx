import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { HotStocksList } from "@/components/dashboard/HotStocksList";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { SectorPerformance } from "@/components/dashboard/SectorPerformance";
import { MarketBreadth } from "@/components/dashboard/MarketBreadth";
import { SmartScreener } from "@/components/dashboard/SmartScreener";
import { ResearchOrientationBanner } from "@/components/research/ResearchOrientationBanner";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Search, Shield, Star } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <ResearchOrientationBanner
          title="先從哪裡開始"
          statusLabel="研究入口"
          tone="success"
          summary="如果你是來研究股票，這個平台最自然的路徑是：先看每日報告，再看候選股或自選股，最後才進個股詳情做 drill-down。"
          bullets={[
            "每日報告適合先快速掃市場、事件、候選與風險。",
            "候選股適合比較不同標的的相對強弱與理由。",
            "個股詳情適合深挖 matrix、percentile 與 overlay，但資訊量最大。",
          ]}
          note="這裡是研究系統，不是單純的行情看板。先走對路徑，比先看更多數字重要。"
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          研究入口
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ResearchShortcutCard
            href="/report/daily"
            title="每日研究報告"
            desc="先看市場環境、候選動向、風險與研究覆蓋度。"
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <ResearchShortcutCard
            href="/candidates"
            title="候選股研究"
            desc="比較強勢 / 觀察標的，查看理由、矩陣與 percentile。"
            icon={<Star className="h-5 w-5" />}
          />
          <ResearchShortcutCard
            href="/watchlist"
            title="自選股觀察"
            desc="看持股脈絡、風險集中度與持倉損益。"
            icon={<Shield className="h-5 w-5" />}
          />
          <ResearchShortcutCard
            href="/stocks/2330"
            title="個股深挖"
            desc="直接進入個股頁，查看完整研究矩陣與 drill-down。"
            icon={<Search className="h-5 w-5" />}
          />
        </div>
      </section>

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

function ResearchShortcutCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border/40 bg-background/70 p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {icon}
            研究入口
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
