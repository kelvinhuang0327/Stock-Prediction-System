import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { HotStocksList } from "@/components/dashboard/HotStocksList";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { SectorPerformance } from "@/components/dashboard/SectorPerformance";
import { MarketBreadth } from "@/components/dashboard/MarketBreadth";
import { SmartScreener } from "@/components/dashboard/SmartScreener";

export default function Home() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold mb-4">Market Overview</h2>
        <MarketOverview />
      </section>

      <section>
        <SectorPerformance />
      </section>

      <section>
        <MarketBreadth />
      </section>

      <section>
        <SmartScreener />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Hot Stocks</h2>
          <HotStocksList />
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-4">Latest News</h2>
          <NewsFeed />
        </section>
      </div>
    </div>
  );
}
