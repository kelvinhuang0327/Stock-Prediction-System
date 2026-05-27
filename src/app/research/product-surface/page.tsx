/**
 * P85 — Stock Research Product Surface Page
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
 * Authorization: P85-GATE 2026-05-27
 * Token: P85_GATE_FRONTEND_PRODUCT_SURFACE_PAGE_APPROVED_WITH_STRICT_SCOPE
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
      <main>
        <p>Unable to load research surface.</p>
      </main>
    );
  }

  const surface = data;

  return (
    <main>
      <h1>Stock Research Product Surface</h1>

      <section aria-label="disclaimer">
        <p>Research scaffold sample only. Not investment advice.</p>
      </section>

      <section aria-label="content-body">
        <h2>Content Body</h2>
        <pre>{surface.contentBody}</pre>
      </section>

      <section aria-label="metadata">
        <h2>Metadata</h2>
        <dl>
          <dt>Artifact Title</dt>
          <dd>{surface.metadata.artifactTitle}</dd>
          <dt>Artifact Version</dt>
          <dd>{surface.metadata.artifactVersion}</dd>
          <dt>Research Card Count</dt>
          <dd>{String(surface.metadata.researchCardCount)}</dd>
          <dt>Simulation Audit Card Count</dt>
          <dd>{String(surface.metadata.simulationAuditCardCount)}</dd>
        </dl>
      </section>

      <section aria-label="route-info">
        <h2>Route Info</h2>
        <dl>
          <dt>Status</dt>
          <dd>{surface.status}</dd>
          <dt>Version</dt>
          <dd>{surface.version}</dd>
          <dt>Generated At</dt>
          <dd>{surface.generatedAt}</dd>
          <dt>File Name</dt>
          <dd>{surface.fileName}</dd>
          <dt>MIME Type</dt>
          <dd>{surface.mimeType}</dd>
        </dl>
      </section>

      <section aria-label="governance-flags">
        <h2>Governance Flags</h2>
        <ul>
          {GOVERNANCE_FLAG_KEYS.map((flagKey) => (
            <li key={flagKey}>
              <span>{flagKey}</span>
              <span>{String(surface.governanceFlags[flagKey])}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
