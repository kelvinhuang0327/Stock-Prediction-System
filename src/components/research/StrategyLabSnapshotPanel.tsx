import { AlertTriangle, FileText, FlaskConical, ShieldCheck } from "lucide-react";

import {
  STRATEGY_LAB_RESULT_NOT_AVAILABLE,
  STRATEGY_LAB_SNAPSHOT_DIAGNOSTIC_CAVEAT,
  buildStrategyLabResultSnapshot,
  type StrategyLabResultSnapshotBlock,
} from "@/lib/research/strategyLabResultSnapshot";
import type { StrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";

interface StrategyLabSnapshotPanelProps {
  snapshot: StrategyLabSnapshot;
}

const BLOCK_ICONS = [
  <FileText key="prediction" className="h-4 w-4 text-sky-300" />,
  <FlaskConical key="retraining" className="h-4 w-4 text-emerald-300" />,
  <ShieldCheck key="validation" className="h-4 w-4 text-violet-300" />,
  <AlertTriangle key="replay" className="h-4 w-4 text-amber-300" />,
] as const;

function SnapshotBlock({
  block,
  icon,
}: {
  block: StrategyLabResultSnapshotBlock;
  icon: React.ReactNode;
}) {
  const unavailable = block.status === "not_available";

  return (
    <div className="min-w-0 rounded-md border border-border/45 bg-background/45 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className="truncate text-sm font-semibold text-white">{block.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          unavailable
            ? "border-amber-300/45 bg-amber-500/10 text-amber-100"
            : "border-emerald-300/45 bg-emerald-500/10 text-emerald-100"
        }`}>
          {unavailable ? STRATEGY_LAB_RESULT_NOT_AVAILABLE : "artifact-backed"}
        </span>
      </div>

      <dl className="space-y-2">
        {block.metrics.map((metric) => (
          <div key={metric.label} className="grid gap-1">
            <dt className="text-[11px] font-medium uppercase text-muted-foreground">{metric.label}</dt>
            <dd className="break-words text-sm leading-5 text-foreground">{metric.value}</dd>
            {metric.note && <dd className="break-words text-xs leading-5 text-muted-foreground">{metric.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-3 rounded-md border border-border/30 bg-card/50 px-2.5 py-2 text-xs leading-5 text-muted-foreground">
        <p className="break-words">source: {block.provenance.source}</p>
        <p className="break-words">artifact file mtime: {block.provenance.artifactFileMtime}</p>
        <p className="break-words">run recorded time: {block.provenance.runRecordedAt}</p>
        <p className="break-words">run id: {block.provenance.runId}</p>
      </div>
    </div>
  );
}

export function StrategyLabSnapshotPanel({ snapshot }: StrategyLabSnapshotPanelProps) {
  const resultSnapshot = buildStrategyLabResultSnapshot(snapshot);
  const blocks = [
    resultSnapshot.prediction,
    resultSnapshot.retraining,
    resultSnapshot.resolvedValidation,
    resultSnapshot.researchReplay,
  ];

  return (
    <section className="min-w-0 rounded-lg border border-border/50 bg-card/70 p-5" aria-label={resultSnapshot.title}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-semibold">{resultSnapshot.title}</h2>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Compact artifact-backed historical validation summary from the existing Strategy Lab payload.
          </p>
          <p className="max-w-4xl text-sm leading-6 text-amber-100">
            {STRATEGY_LAB_SNAPSHOT_DIAGNOSTIC_CAVEAT}
          </p>
          <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
            Snapshot payload generated time: {resultSnapshot.generatedAt}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/45 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5" />
          diagnostic-only
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {blocks.map((block, index) => (
          <SnapshotBlock key={block.title} block={block} icon={BLOCK_ICONS[index]} />
        ))}
      </div>

      <div className="mt-3 min-w-0 rounded-md border border-border/45 bg-background/45 p-3">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-white">{resultSnapshot.provenanceAndCaveats.title}</h3>
          </div>
          <span className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
            {resultSnapshot.provenanceAndCaveats.mixedRun ? "MIXED_RUN" : "same run id where available"}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <dl className="grid gap-2 sm:grid-cols-2">
            {resultSnapshot.provenanceAndCaveats.metrics.map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-border/30 bg-card/50 px-2.5 py-2">
                <dt className="text-[11px] font-medium uppercase text-muted-foreground">{metric.label}</dt>
                <dd className="mt-1 break-words text-sm leading-5 text-foreground">{metric.value}</dd>
                {metric.note && <dd className="mt-1 break-words text-xs leading-5 text-muted-foreground">{metric.note}</dd>}
              </div>
            ))}
          </dl>

          <ul className="grid content-start gap-2 text-xs leading-5 text-muted-foreground">
            {resultSnapshot.provenanceAndCaveats.caveats.map((caveat) => (
              <li key={caveat} className="rounded-md border border-border/30 bg-card/50 px-2.5 py-2">
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
