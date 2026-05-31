// StockResearchProductSurfaceRealLikeFixture.ts
// P97 static REAL_LIKE_FIXTURE — sample-only, deterministic, non-production, non-real-data
// This file is auto-generated for P97. Do not use in production or for real data.

export const STOCK_RESEARCH_PRODUCT_SURFACE_REAL_LIKE_FIXTURE_VERSION = 'P97-20260531-v1';

export type StockResearchProductSurfaceRealLikeFixtureGovernanceFlags = {
  realDataPermitted: false;
  productionReady: false;
  entersAlphaScore: false;
  noForecast: true;
  noRecommendation: true;
  noInvestmentAdvice: true;
  noExecution: true;
};

export type StockResearchProductSurfaceRealLikeFixture = {
  version: string;
  governance: StockResearchProductSurfaceRealLikeFixtureGovernanceFlags;
  stock: {
    symbol: string;
    name: string;
    market: string;
    industry: string;
  };
  marketSnapshot: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    date: string; // static ISO string
  };
  companySnapshot: {
    ceo: string;
    founded: string;
    headquarters: string;
    employees: number;
  };
  pit: {
    asOf: string; // static ISO string
    ordering: number;
  };
  notes: string;
};

export function buildStockResearchProductSurfaceRealLikeFixture(): StockResearchProductSurfaceRealLikeFixture {
  return {
    version: STOCK_RESEARCH_PRODUCT_SURFACE_REAL_LIKE_FIXTURE_VERSION,
    governance: {
      realDataPermitted: false,
      productionReady: false,
      entersAlphaScore: false,
      noForecast: true,
      noRecommendation: true,
      noInvestmentAdvice: true,
      noExecution: true,
    },
    stock: {
      symbol: '2330',
      name: '台積電',
      market: 'TWSE',
      industry: '半導體',
    },
    marketSnapshot: {
      open: 800,
      high: 820,
      low: 795,
      close: 815,
      volume: 1000000,
      date: '2023-12-29T00:00:00.000Z', // static
    },
    companySnapshot: {
      ceo: 'C.C. Wei',
      founded: '1987-02-21',
      headquarters: '新竹科學園區',
      employees: 65000,
    },
    pit: {
      asOf: '2023-12-29T00:00:00.000Z', // static
      ordering: 1,
    },
    notes: 'This is a static, sample-only, non-production REAL_LIKE_FIXTURE for P97. No real data. Do not use for investment.'
  };
}
