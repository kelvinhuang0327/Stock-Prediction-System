/**
 * P86 — Stock Research Product Surface Page (Visual Polish)
 *
 * Styling-only update to P85 bare HTML page.
 * Applies Tailwind CSS visual hierarchy; zero logic changes.
 *
 * Read-only frontend page. Fetches GET /api/research/product-surface (P83 route).
 * Displays sample contentBody, metadata, route info, all 10 governance flags,
 * and mandatory sample-only disclaimer.
 *
 * Governance:
 *   - reviewOnly = true
 *   - noInvestmentAdvice = true
 *   - noForecast = true
 *   - noRecommendation = true
 *   - previewOnly = true
 *   - paperOnly = true
 *   - noExecution = true
 *   - noActualMetrics = true
 *   - entersAlphaScore = false (ALWAYS)
 *   - notInvestmentAdvice = true
 *
 * Rules:
 *   - No ticker input, date picker, simulation trigger, or action UI
 *   - No DB, Prisma, source adapter, external API, auth/session, or server action
 *   - Server Component — no "use client", no useState, no useEffect
 *   - contentBody rendered as <pre> (safe, no HTML injection)
 *
 * Authorization: P86-GATE 2026-05-27
 * Token: P86_GATE_VISUAL_POLISH_APPROVED_WITH_STRICT_SCOPE
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

// ─── Inline response type (mirrors P81 shape — no runtime import from P81) ───

type ProductSurfaceGovernanceFlags = {
  reviewOnly: boolean;
  noInvestmentAdvice: boolean;
  noForecast: boolean;
  noRecommendation: boolean;
  previewOnly: boolean;
  paperOnly: boolean;
  noExecution: boolean;
  noActualMetrics: boolean;
  entersAlphaScore: boolean;
  notInvestmentAdvice: boolean;
};

type ProductSurfaceMetadata = {
  artifactTitle: string;
  artifactVersion: string;
  researchCardCount: number;
  simulationAuditCardCount: number;
};

type ProductSurfaceResponse = {
  status: string;
  version: string;
  generatedAt: string;
  fileName: string;
  mimeType: string;
  contentBody: string;
  metadata: ProductSurfaceMetadata;
  governanceFlags: ProductSurfaceGovernanceFlags;
};

// ─── Governance flag display order ────────────────────────────────────────────

const GOVERNANCE_FLAG_KEYS: ReadonlyArray<keyof ProductSurfaceGovernanceFlags> = [
  "reviewOnly",
  "noInvestmentAdvice",
  "noForecast",
  "noRecommendation",
  "previewOnly",
  "paperOnly",
  "noExecution",
  "noActualMetrics",
  "entersAlphaScore",
  "notInvestmentAdvice",
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductSurfacePage() {
  let data: ProductSurfaceResponse | null = null;
  let loadError = false;

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/research/product-surface`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      loadError = true;
    } else {
      data = (await res.json()) as ProductSurfaceResponse;
    }
  } catch {
    loadError = true;
  }

  if (loadError || !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-sm text-gray-600">Unable to load research surface.</p>
      </main>
    );
  }

  const surface = data;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* ── Header card ──────────────────────────────────────────────── */}
        <header className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Stock Research Product Surface
          </h1>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              Sample Only
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
              Review Only
            </span>
          </div>
          <section aria-label="disclaimer" className="border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 rounded-r-md">
            <p className="text-sm text-yellow-800">
              Research scaffold sample only. Not investment advice.
            </p>
          </section>
        </header>

        {/* ── Content body card ─────────────────────────────────────────── */}
        <section aria-label="content-body" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Content Body</h2>
          <pre className="overflow-x-auto rounded-md bg-gray-50 border border-gray-100 p-4 text-sm font-mono text-gray-700 max-h-64">
            {surface.contentBody}
          </pre>
        </section>

        {/* ── Metadata card ─────────────────────────────────────────────── */}
        <section aria-label="metadata" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Metadata</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <dt className="text-sm font-medium text-gray-500">Artifact Title</dt>
            <dd className="text-sm text-gray-900">{surface.metadata.artifactTitle}</dd>
            <dt className="text-sm font-medium text-gray-500">Artifact Version</dt>
            <dd className="text-sm text-gray-900">{surface.metadata.artifactVersion}</dd>
            <dt className="text-sm font-medium text-gray-500">Research Card Count</dt>
            <dd className="text-sm text-gray-900">{String(surface.metadata.researchCardCount)}</dd>
            <dt className="text-sm font-medium text-gray-500">Simulation Audit Card Count</dt>
            <dd className="text-sm text-gray-900">{String(surface.metadata.simulationAuditCardCount)}</dd>
          </dl>
        </section>

        {/* ── Route info panel ──────────────────────────────────────────── */}
        <section aria-label="route-info" className="rounded-lg bg-gray-50 border border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Route Info</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="text-sm text-gray-800">{surface.status}</dd>
            <dt className="text-sm font-medium text-gray-500">Version</dt>
            <dd className="text-sm font-mono text-gray-800">{surface.version}</dd>
            <dt className="text-sm font-medium text-gray-500">Generated At</dt>
            <dd className="text-sm font-mono text-gray-800">{surface.generatedAt}</dd>
            <dt className="text-sm font-medium text-gray-500">File Name</dt>
            <dd className="text-sm font-mono text-gray-800">{surface.fileName}</dd>
            <dt className="text-sm font-medium text-gray-500">MIME Type</dt>
            <dd className="text-sm font-mono text-gray-800">{surface.mimeType}</dd>
          </dl>
        </section>

        {/* ── Governance flags ──────────────────────────────────────────── */}
        <section aria-label="governance-flags" className="rounded-lg bg-white shadow-sm border border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Governance Flags</h2>
          <ul className="space-y-1">
            {GOVERNANCE_FLAG_KEYS.map((flagKey) => {
              const flagValue = String(surface.governanceFlags[flagKey]);
              const badgeClass =
                flagValue === "true"
                  ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                  : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20";
              return (
                <li
                  key={flagKey}
                  className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm font-mono text-gray-700">{flagKey}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                    {flagValue}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-gray-400 pb-4">
          Research scaffold sample only. Not investment advice.
        </footer>

      </div>
    </main>
  );
}
