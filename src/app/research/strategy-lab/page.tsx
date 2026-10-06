import type { Metadata } from "next";

import { StrategyLabClient } from "@/components/research/StrategyLabClient";
import { readStrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "策略研究 Lab",
  description: "台股策略 refit、歷史 holdout 驗證與 protocol comparison 結果。",
};

export default async function StrategyLabPage() {
  const snapshot = await readStrategyLabSnapshot();
  return <StrategyLabClient initialSnapshot={snapshot} />;
}
