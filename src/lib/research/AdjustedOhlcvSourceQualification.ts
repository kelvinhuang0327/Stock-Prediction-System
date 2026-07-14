import { createHash } from "node:crypto";

export const EXISTING_PRICE_DISCONTINUITY_THRESHOLD = 0.5;
export const REQUIRED_PROMOTION_ELIGIBILITY =
  "BLOCKED_PENDING_ADJUSTED_SOURCE_REFIT" as const;
export const AUTHORIZED_INPUT_SHA256 =
  "2d1aaee13c11015b7d9619e7fe45901cf87283694679a32a410ac03e4854185f";

export const TWSE_QUALIFICATION_ENDPOINTS = Object.freeze({
  splitReference:
    "https://www.twse.com.tw/rwd/zh/split/TWTCAU?startDate=20250618&endDate=20250618&response=json",
  stockDay0050:
    "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20250601&stockNo=0050",
  stockDay2330:
    "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20250601&stockNo=2330",
});

export const TWSE_0050_DISCLOSURE = Object.freeze({
  url:
    "https://www.twse.com.tw/zh/ETFortune/announcement?company=A00005&date=20250617&fund=0050&seq=1&type=other",
  publishedAt: "2025-06-17T03:35:21.000Z",
  displayedPublishedAt: "2025-06-17 11:35:21 Asia/Taipei",
  sourceDocumentIdentifier: "TWSE_ETFORTUNE_0050_20250617_SEQ1",
});

export type PointInTimeStatus =
  | "PIT_PROVEN"
  | "PIT_PARTIALLY_PROVEN"
  | "PIT_UNPROVEN";
export type QualificationStatus = "PASS" | "BLOCKED";
export type ExecutionMode = "FIXTURE" | "LIVE_PROBE";
export type CorporateActionType = "ETF_SPLIT" | "ETF_REVERSE_SPLIT";
export type TimestampEvidence =
  | "HISTORICAL_PUBLICATION"
  | "CURRENT_AVAILABILITY_ONLY"
  | "NONE";
export type DatasetIdentifier =
  | "TWSE_TWTCAU_2025-06-18"
  | "TWSE_STOCK_DAY_0050_2025-06"
  | "TWSE_STOCK_DAY_2330_2025-06";

export interface SourceCandidateEvaluation {
  sourceName: string;
  operator: string;
  publicDocumentationLocations: readonly string[];
  accessMethod: string;
  authenticationRequirement: string;
  rateLimitOrStabilityNotes: string;
  adjustedPriceSupport: string;
  corporateActionEventSupport: string;
  historicalCoverage: string;
  publicationAvailabilityTimestampSupport: string;
  licenseOrUsageRestrictionEvidence: string;
  decision: "ACCEPTED" | "REJECTED";
  reason: string;
}

export const SOURCE_CANDIDATE_EVALUATIONS: readonly SourceCandidateEvaluation[] =
  Object.freeze([
    Object.freeze({
      sourceName: "TWSE split-reference and STOCK_DAY reports",
      operator: "Taiwan Stock Exchange Corporation",
      publicDocumentationLocations: Object.freeze([
        "https://www.twse.com.tw/zh/announcement/split/twtcau.html",
        "https://www.twse.com.tw/en/announcement/split/twtcau.html",
        TWSE_0050_DISCLOSURE.url,
        "https://data.gov.tw/dataset/11549",
        "https://www.twse.com.tw/zh/terms/use.html",
      ]),
      accessMethod:
        "Three bounded public HTTPS GET requests: one split-reference window and one monthly STOCK_DAY response per symbol.",
      authenticationRequirement: "None; no token, cookie, account, or credential.",
      rateLimitOrStabilityNotes:
        "No numeric rate-limit contract is published for these report endpoints; the adapter makes exactly three requests and fails closed on HTTP 429, schema drift, or transport failure.",
      adjustedPriceSupport:
        "No general adjusted-OHLCV series. TWTCAU publishes the explicit pre-event close and post-split reference-price relationship used for adjustment.",
      corporateActionEventSupport:
        "TWTCAU identifies ETF split/reverse-split type and effective resumption date.",
      historicalCoverage:
        "The bounded endpoints reproduce the required June 2025 window; full retention depth is not documented and remains a qualification risk.",
      publicationAvailabilityTimestampSupport:
        "The official 0050 disclosure records a 2025-06-17 11:35:21 Asia/Taipei publication before the 2025-06-18 event, but report payloads omit per-record publication/version timestamps.",
      licenseOrUsageRestrictionEvidence:
        "TWSE terms permit research reference with clear attribution; the government daily-price dataset is free under Open Government Data License 1.0. Raw payloads are neither persisted nor redistributed by this adapter.",
      decision: "ACCEPTED",
      reason:
        "Official, credential-free event and raw-price evidence reconciles 0050 while matching the committed CSV and producing no event for 2330.",
    }),
    Object.freeze({
      sourceName: "FinMind TaiwanStockPriceAdj",
      operator: "FinMind",
      publicDocumentationLocations: Object.freeze([
        "https://finmind.github.io/tutor/TaiwanMarket/Technical/",
        "https://api.finmindtrade.com/docs",
        "https://github.com/FinMind/FinMind",
      ]),
      accessMethod: "HTTPS data API and Apache-2.0 open-source client.",
      authenticationRequirement:
        "The adjusted-price dataset is documented as limited to backer/sponsor members and examples are token-oriented.",
      rateLimitOrStabilityNotes:
        "Documentation states 300 requests/hour without a token and 600/hour with a registered token; weekly maintenance is also documented.",
      adjustedPriceSupport:
        "TaiwanStockPriceAdj is documented from 1994-10-01 to present, but access is membership-restricted.",
      corporateActionEventSupport:
        "The catalog exposes split-related datasets, but the adjusted series does not include traceable per-row event-factor provenance in its published schema.",
      historicalCoverage: "Documented from 1994-10-01 to present.",
      publicationAvailabilityTimestampSupport:
        "A weekday update schedule is documented, not a historical per-record availability timestamp.",
      licenseOrUsageRestrictionEvidence:
        "The client is Apache-2.0, while project content/data is limited to educational non-commercial use and the required adjusted dataset is member-restricted.",
      decision: "REJECTED",
      reason:
        "The required adjusted dataset is not credential-free/public under the task contract, and factor-level provenance plus historical availability are insufficient.",
    }),
  ]);

export interface FetchHeadersLike {
  get(name: string): string | null;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers?: FetchHeadersLike;
  text(): Promise<string>;
}

export interface FetchRequestInitLike {
  method: "GET";
  headers: Readonly<Record<string, string>>;
}

export type InjectedFetch = (
  url: string,
  init: FetchRequestInitLike,
) => Promise<FetchResponseLike>;

export interface RequestInventoryItem {
  datasetIdentifier: DatasetIdentifier;
  domain: "www.twse.com.tw";
  url: string;
  method: "GET";
  responseStatus: number;
  rawPayloadSha256: string;
}

export interface PayloadHash {
  datasetIdentifier: DatasetIdentifier;
  rawPayloadSha256: string;
}

export interface NormalizedCorporateAction {
  symbol: string;
  corporateActionType: CorporateActionType;
  effectiveDate: string;
  preEventRawClose: number;
  sourceReferenceAdjustedClose: number;
  adjustmentFactor: number;
  sourcePublicationAvailabilityTimestamp: string | null;
  timestampEvidence: TimestampEvidence;
  sourceIdentifier: "TWSE";
  sourceDocumentOrDatasetIdentifier: "TWSE_TWTCAU_2025-06-18";
  sourceDisclosureIdentifier: string;
  fetchedAtTimestamp: string;
  rawPayloadSha256: string;
}

export interface NormalizedAdjustedOhlcvRecord {
  symbol: string;
  tradingDate: string;
  rawClose: number;
  adjustedClose: number;
  adjustmentFactor: number;
  corporateActionType: CorporateActionType | null;
  effectiveDate: string | null;
  sourcePublicationAvailabilityTimestamp: string | null;
  timestampEvidence: TimestampEvidence;
  sourceIdentifier: "TWSE";
  sourceDocumentOrDatasetIdentifier: DatasetIdentifier;
  fetchedAtTimestamp: string;
  rawPayloadSha256: string;
  corporateActionPayloadSha256: string | null;
}

interface NormalizedRawPriceRecord {
  symbol: string;
  tradingDate: string;
  rawClose: number;
  sourcePublicationAvailabilityTimestamp: string | null;
  fetchedAtTimestamp: string;
  rawPayloadSha256: string;
  datasetIdentifier:
    | "TWSE_STOCK_DAY_0050_2025-06"
    | "TWSE_STOCK_DAY_2330_2025-06";
}

export interface PointInTimeEvidence {
  sourcePublicationAvailabilityTimestamp: string | null;
  timestampEvidence: TimestampEvidence;
  evidenceIdentifier: string;
}

export interface TwseSourceSnapshot {
  executionMode: ExecutionMode;
  fetchedAtTimestamp: string;
  events: NormalizedCorporateAction[];
  records: NormalizedAdjustedOhlcvRecord[];
  payloadHashes: PayloadHash[];
  requestInventory: RequestInventoryItem[];
}

export interface CommittedObservation {
  symbol: "0050" | "2330";
  tradingDate: "2025-06-10" | "2025-06-18";
  rawClose: number;
}

export interface ReconciliationResult {
  status: "RECONCILED" | "BLOCKED";
  priorTradingDate: string | null;
  nextTradingDate: string | null;
  committedPriorRawClose: number | null;
  committedNextRawClose: number | null;
  sourcePriorRawClose: number | null;
  sourceNextRawClose: number | null;
  sourceReferenceAdjustedClose: number | null;
  derivedAdjustmentFactor: number | null;
  adjustedPriorClose: number | null;
  adjustedNextClose: number | null;
  rawCloseToCloseReturn: number | null;
  adjustedCloseToCloseReturn: number | null;
  discontinuityThreshold: number;
  effectiveDate: string | null;
  corporateActionType: CorporateActionType | null;
  sourcePublicationAvailabilityTimestamp: string | null;
  reconciledBelowThreshold: boolean;
  blockReasons: string[];
}

export interface ControlResult {
  status: "PASS" | "BLOCKED";
  priorTradingDate: string | null;
  nextTradingDate: string | null;
  committedPriorRawClose: number | null;
  committedNextRawClose: number | null;
  sourcePriorRawClose: number | null;
  sourceNextRawClose: number | null;
  corporateActionReported: boolean;
  adjustmentFactor: number | null;
  adjustedCloseToCloseReturn: number | null;
  fabricatedEvent: boolean;
  blockReasons: string[];
}

export interface QualificationResult {
  qualificationStatus: QualificationStatus;
  executionMode: ExecutionMode;
  selectedSource: "TWSE split-reference and STOCK_DAY reports";
  sourceOperator: "Taiwan Stock Exchange Corporation";
  sourceType: "OFFICIAL_EXCHANGE";
  authenticationRequired: false;
  adjustedOhlcvSupported: false;
  corporateActionsSupported: true;
  pointInTimeStatus: PointInTimeStatus;
  historicalCoverage: string;
  sourceProvenance: {
    candidateEvaluations: readonly SourceCandidateEvaluation[];
    selectedDocumentation: readonly string[];
    sourceDisclosurePublishedAt: string;
    requestInventory: RequestInventoryItem[];
    normalizedRecords: NormalizedAdjustedOhlcvRecord[];
  };
  payloadHashes: PayloadHash[];
  "0050Reconciliation": ReconciliationResult;
  "2330Control": ControlResult;
  remainingRisks: readonly string[];
  promotionEligibility: typeof REQUIRED_PROMOTION_ELIGIBILITY;
  credentialsReadOrRequested: false;
  fetchedDataPersisted: false;
  httpMethodsUsed: readonly ["GET"];
  blockReasons: string[];
}

type QualificationErrorCode =
  | "COMMITTED_INPUT_SHA256_MISMATCH"
  | "COMMITTED_OBSERVATION_CONFLICT"
  | "COMMITTED_OBSERVATION_MISSING"
  | "CONFLICTING_EVENT_FACTORS"
  | "CONTROL_SYMBOL_EVENT_REPORTED"
  | "DUPLICATE_RECORD"
  | "EVENT_EFFECTIVE_DATE_MISALIGNED"
  | "EXPECTED_RAW_DISCONTINUITY_MISSING"
  | "FUTURE_PUBLICATION_FOR_AS_OF"
  | "INVALID_DATE"
  | "INVALID_JSON"
  | "INVALID_NUMERIC_FIELD"
  | "INVALID_TIMESTAMP"
  | "MISSING_ADJUSTMENT_METADATA"
  | "MISSING_REQUIRED_FIELD"
  | "OUT_OF_ORDER_RECORDS"
  | "PAYLOAD_SHA256_MISMATCH"
  | "RECONCILIATION_THRESHOLD_FAILED"
  | "TWSE_HTTP_ERROR"
  | "TWSE_NETWORK_ERROR"
  | "TWSE_RATE_LIMITED"
  | "TWSE_REPORT_NOT_OK"
  | "UNRECOGNIZED_EVENT_TYPE";

export class AdjustedOhlcvQualificationError extends Error {
  readonly code: QualificationErrorCode;

  constructor(code: QualificationErrorCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "AdjustedOhlcvQualificationError";
    this.code = code;
  }
}

function fail(code: QualificationErrorCode, detail?: string): never {
  throw new AdjustedOhlcvQualificationError(code, detail);
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rawPayloadSha256(rawPayload: string): string {
  return createHash("sha256").update(rawPayload, "utf8").digest("hex");
}

export function verifyRawPayloadSha256(
  rawPayload: string,
  expectedSha256: string,
): string {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    fail("PAYLOAD_SHA256_MISMATCH", "expected_sha256_is_not_canonical");
  }
  const actual = rawPayloadSha256(rawPayload);
  if (actual !== expectedSha256) {
    fail("PAYLOAD_SHA256_MISMATCH", `expected=${expectedSha256}:actual=${actual}`);
  }
  return actual;
}

function parseJsonReport(rawPayload: string, datasetIdentifier: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload) as unknown;
  } catch {
    fail("INVALID_JSON", datasetIdentifier);
  }
  if (!isRecord(parsed)) fail("INVALID_JSON", `${datasetIdentifier}:root_not_object`);
  if (parsed.stat !== "OK") fail("TWSE_REPORT_NOT_OK", datasetIdentifier);
  return parsed;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail("MISSING_REQUIRED_FIELD", field);
  }
  return value.trim();
}

function parseRequiredNumber(value: unknown, field: string): number {
  const text = requiredString(value, field).replaceAll(",", "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    fail("INVALID_NUMERIC_FIELD", field);
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) fail("INVALID_NUMERIC_FIELD", field);
  return parsed;
}

function parseRocDate(value: unknown, field: string): string {
  const text = requiredString(value, field);
  const match = /^(\d{3})\/(\d{2})\/(\d{2})$/.exec(text);
  if (!match) fail("INVALID_DATE", field);
  const year = Number(match[1]) + 1911;
  const iso = `${String(year).padStart(4, "0")}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    fail("INVALID_DATE", field);
  }
  return iso;
}

function requireCanonicalTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail("INVALID_TIMESTAMP", field);
  }
  return value;
}

function optionalHttpTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function reportTable(
  report: Record<string, unknown>,
  datasetIdentifier: string,
): { fields: string[]; rows: unknown[][] } {
  if (!Array.isArray(report.fields)) {
    fail("MISSING_REQUIRED_FIELD", `${datasetIdentifier}.fields`);
  }
  const fields = report.fields.map((value, index) =>
    requiredString(value, `${datasetIdentifier}.fields[${index}]`));
  if (new Set(fields).size !== fields.length) {
    fail("DUPLICATE_RECORD", `${datasetIdentifier}:duplicate_field`);
  }
  if (!Array.isArray(report.data)) {
    fail("MISSING_REQUIRED_FIELD", `${datasetIdentifier}.data`);
  }
  const rows = report.data.map((row, index) => {
    if (!Array.isArray(row) || row.length !== fields.length) {
      fail("MISSING_REQUIRED_FIELD", `${datasetIdentifier}.data[${index}]`);
    }
    return row;
  });
  return { fields, rows };
}

function fieldIndex(fields: readonly string[], field: string, datasetIdentifier: string): number {
  const index = fields.indexOf(field);
  if (index < 0) fail("MISSING_REQUIRED_FIELD", `${datasetIdentifier}.${field}`);
  return index;
}

function eventType(value: unknown): CorporateActionType {
  const normalized = requiredString(value, "corporate_action_type");
  if (normalized === "分割") return "ETF_SPLIT";
  if (normalized === "反分割") return "ETF_REVERSE_SPLIT";
  fail("UNRECOGNIZED_EVENT_TYPE", normalized);
}

interface SplitParseContext {
  fetchedAtTimestamp: string;
  rawPayloadSha256: string;
}

export function normalizeTwseSplitReferencePayload(
  rawPayload: string,
  context: SplitParseContext,
): NormalizedCorporateAction[] {
  requireCanonicalTimestamp(context.fetchedAtTimestamp, "fetched_at_timestamp");
  const report = parseJsonReport(rawPayload, "TWSE_TWTCAU_2025-06-18");
  const { fields, rows } = reportTable(report, "TWSE_TWTCAU_2025-06-18");
  const dateIndex = fieldIndex(fields, "恢復買賣日期", "TWSE_TWTCAU_2025-06-18");
  const symbolIndex = fieldIndex(fields, "ETF代號", "TWSE_TWTCAU_2025-06-18");
  const typeIndex = fieldIndex(fields, "分割(反分割)", "TWSE_TWTCAU_2025-06-18");
  const preCloseIndex = fieldIndex(
    fields,
    "停止買賣前收盤價格",
    "TWSE_TWTCAU_2025-06-18",
  );
  const referenceIndex = fieldIndex(
    fields,
    "恢復買賣參考價",
    "TWSE_TWTCAU_2025-06-18",
  );
  const events = rows.map((row, index): NormalizedCorporateAction => {
    const symbol = requiredString(row[symbolIndex], `event[${index}].symbol`);
    const preEventRawClose = parseRequiredNumber(
      row[preCloseIndex],
      `event[${index}].pre_event_close`,
    );
    const sourceReferenceAdjustedClose = parseRequiredNumber(
      row[referenceIndex],
      `event[${index}].reference_price`,
    );
    const adjustmentFactor = round(sourceReferenceAdjustedClose / preEventRawClose, 12);
    if (!(adjustmentFactor > 0)) {
      fail("MISSING_ADJUSTMENT_METADATA", `event[${index}].adjustment_factor`);
    }
    return {
      symbol,
      corporateActionType: eventType(row[typeIndex]),
      effectiveDate: parseRocDate(row[dateIndex], `event[${index}].effective_date`),
      preEventRawClose,
      sourceReferenceAdjustedClose,
      adjustmentFactor,
      sourcePublicationAvailabilityTimestamp: TWSE_0050_DISCLOSURE.publishedAt,
      timestampEvidence: "HISTORICAL_PUBLICATION",
      sourceIdentifier: "TWSE",
      sourceDocumentOrDatasetIdentifier: "TWSE_TWTCAU_2025-06-18",
      sourceDisclosureIdentifier: TWSE_0050_DISCLOSURE.sourceDocumentIdentifier,
      fetchedAtTimestamp: context.fetchedAtTimestamp,
      rawPayloadSha256: context.rawPayloadSha256,
    };
  });
  const orderedKeys = events.map((event) => `${event.effectiveDate}:${event.symbol}`);
  for (let index = 1; index < orderedKeys.length; index += 1) {
    if (orderedKeys[index] < orderedKeys[index - 1]) {
      fail("OUT_OF_ORDER_RECORDS", "TWSE_TWTCAU_2025-06-18");
    }
  }
  const grouped = new Map<string, NormalizedCorporateAction[]>();
  for (const event of events) {
    const key = `${event.symbol}:${event.effectiveDate}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  for (const [key, duplicates] of grouped) {
    if (duplicates.length <= 1) continue;
    if (new Set(duplicates.map((event) => event.adjustmentFactor)).size > 1) {
      fail("CONFLICTING_EVENT_FACTORS", key);
    }
    fail("DUPLICATE_RECORD", key);
  }
  return events.sort((left, right) =>
    compareText(`${left.effectiveDate}:${left.symbol}`, `${right.effectiveDate}:${right.symbol}`));
}

interface PriceParseContext {
  symbol: "0050" | "2330";
  datasetIdentifier:
    | "TWSE_STOCK_DAY_0050_2025-06"
    | "TWSE_STOCK_DAY_2330_2025-06";
  fetchedAtTimestamp: string;
  sourceAvailabilityTimestamp: string | null;
  rawPayloadSha256: string;
}

function normalizeTwseStockDayPayload(
  rawPayload: string,
  context: PriceParseContext,
): NormalizedRawPriceRecord[] {
  requireCanonicalTimestamp(context.fetchedAtTimestamp, "fetched_at_timestamp");
  const report = parseJsonReport(rawPayload, context.datasetIdentifier);
  const { fields, rows } = reportTable(report, context.datasetIdentifier);
  const dateIndex = fieldIndex(fields, "日期", context.datasetIdentifier);
  const closeIndex = fieldIndex(fields, "收盤價", context.datasetIdentifier);
  const parsed = rows.map((row, index): NormalizedRawPriceRecord => ({
    symbol: context.symbol,
    tradingDate: parseRocDate(row[dateIndex], `${context.datasetIdentifier}[${index}].date`),
    rawClose: parseRequiredNumber(
      row[closeIndex],
      `${context.datasetIdentifier}[${index}].close`,
    ),
    sourcePublicationAvailabilityTimestamp:
      context.sourceAvailabilityTimestamp ?? context.fetchedAtTimestamp,
    fetchedAtTimestamp: context.fetchedAtTimestamp,
    rawPayloadSha256: context.rawPayloadSha256,
    datasetIdentifier: context.datasetIdentifier,
  }));
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index].tradingDate === parsed[index - 1].tradingDate) {
      fail("DUPLICATE_RECORD", `${context.symbol}:${parsed[index].tradingDate}`);
    }
    if (parsed[index].tradingDate < parsed[index - 1].tradingDate) {
      fail("OUT_OF_ORDER_RECORDS", context.datasetIdentifier);
    }
  }
  return parsed;
}

function requiredPriceRecord(
  records: readonly NormalizedRawPriceRecord[],
  symbol: "0050" | "2330",
  tradingDate: "2025-06-10" | "2025-06-18",
): NormalizedRawPriceRecord {
  const matches = records.filter((record) =>
    record.symbol === symbol && record.tradingDate === tradingDate);
  if (matches.length !== 1) {
    fail(
      matches.length === 0 ? "MISSING_REQUIRED_FIELD" : "DUPLICATE_RECORD",
      `${symbol}:${tradingDate}`,
    );
  }
  return matches[0];
}

function buildNormalizedRecords(
  events: readonly NormalizedCorporateAction[],
  prices: readonly NormalizedRawPriceRecord[],
): NormalizedAdjustedOhlcvRecord[] {
  const selectedEvents = events.filter((event) => event.symbol === "0050");
  if (selectedEvents.length === 0) {
    fail("MISSING_ADJUSTMENT_METADATA", "0050:2025-06-18");
  }
  if (selectedEvents.length > 1) {
    if (new Set(selectedEvents.map((event) => event.adjustmentFactor)).size > 1) {
      fail("CONFLICTING_EVENT_FACTORS", "0050:2025-06-18");
    }
    fail("DUPLICATE_RECORD", "0050:2025-06-18");
  }
  if (events.some((event) => event.symbol === "2330")) {
    fail("CONTROL_SYMBOL_EVENT_REPORTED", "2330:2025-06-18");
  }
  const event = selectedEvents[0];
  const requested: Array<{
    symbol: "0050" | "2330";
    tradingDate: "2025-06-10" | "2025-06-18";
  }> = [
    { symbol: "0050", tradingDate: "2025-06-10" },
    { symbol: "0050", tradingDate: "2025-06-18" },
    { symbol: "2330", tradingDate: "2025-06-10" },
    { symbol: "2330", tradingDate: "2025-06-18" },
  ];
  return requested.map(({ symbol, tradingDate }) => {
    const price = requiredPriceRecord(prices, symbol, tradingDate);
    const applicableEvent = symbol === "0050" ? event : null;
    const adjustmentFactor = applicableEvent && tradingDate < applicableEvent.effectiveDate
      ? applicableEvent.adjustmentFactor
      : 1;
    return {
      symbol,
      tradingDate,
      rawClose: price.rawClose,
      adjustedClose: round(price.rawClose * adjustmentFactor),
      adjustmentFactor,
      corporateActionType: applicableEvent?.corporateActionType ?? null,
      effectiveDate: applicableEvent?.effectiveDate ?? null,
      sourcePublicationAvailabilityTimestamp:
        price.sourcePublicationAvailabilityTimestamp,
      timestampEvidence: "CURRENT_AVAILABILITY_ONLY",
      sourceIdentifier: "TWSE",
      sourceDocumentOrDatasetIdentifier: price.datasetIdentifier,
      fetchedAtTimestamp: price.fetchedAtTimestamp,
      rawPayloadSha256: price.rawPayloadSha256,
      corporateActionPayloadSha256: applicableEvent?.rawPayloadSha256 ?? null,
    };
  });
}

interface RawFetchResult {
  datasetIdentifier: DatasetIdentifier;
  rawPayload: string;
  rawPayloadSha256: string;
  sourceAvailabilityTimestamp: string | null;
  requestInventory: RequestInventoryItem;
}

export interface TwseAdapterOptions {
  fetchFn: InjectedFetch;
  executionMode: ExecutionMode;
  now?: () => Date;
  expectedPayloadHashes?: Partial<Record<DatasetIdentifier, string>>;
}

export class TwseAdjustedOhlcvSourceAdapter {
  private readonly fetchFn: InjectedFetch;
  private readonly executionMode: ExecutionMode;
  private readonly now: () => Date;
  private readonly expectedPayloadHashes: Partial<Record<DatasetIdentifier, string>>;

  constructor(options: TwseAdapterOptions) {
    this.fetchFn = options.fetchFn;
    this.executionMode = options.executionMode;
    this.now = options.now ?? (() => new Date());
    this.expectedPayloadHashes = options.expectedPayloadHashes ?? {};
  }

  private async fetchOne(
    datasetIdentifier: DatasetIdentifier,
    url: string,
  ): Promise<RawFetchResult> {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.twse.com.tw"
      || parsedUrl.username !== "" || parsedUrl.password !== "") {
      fail("TWSE_NETWORK_ERROR", `${datasetIdentifier}:non_public_endpoint`);
    }
    let response: FetchResponseLike;
    try {
      response = await this.fetchFn(url, {
        method: "GET",
        headers: Object.freeze({ Accept: "application/json" }),
      });
    } catch {
      fail("TWSE_NETWORK_ERROR", datasetIdentifier);
    }
    if (response.status === 429) fail("TWSE_RATE_LIMITED", datasetIdentifier);
    if (!response.ok || response.status < 200 || response.status >= 300) {
      fail("TWSE_HTTP_ERROR", `${datasetIdentifier}:status=${response.status}`);
    }
    let rawPayload: string;
    try {
      rawPayload = await response.text();
    } catch {
      fail("TWSE_NETWORK_ERROR", `${datasetIdentifier}:response_body`);
    }
    const expected = this.expectedPayloadHashes[datasetIdentifier];
    const digest = expected
      ? verifyRawPayloadSha256(rawPayload, expected)
      : rawPayloadSha256(rawPayload);
    return {
      datasetIdentifier,
      rawPayload,
      rawPayloadSha256: digest,
      sourceAvailabilityTimestamp: optionalHttpTimestamp(response.headers?.get("date")),
      requestInventory: {
        datasetIdentifier,
        domain: "www.twse.com.tw",
        url,
        method: "GET",
        responseStatus: response.status,
        rawPayloadSha256: digest,
      },
    };
  }

  async fetchSnapshot(): Promise<TwseSourceSnapshot> {
    const split = await this.fetchOne(
      "TWSE_TWTCAU_2025-06-18",
      TWSE_QUALIFICATION_ENDPOINTS.splitReference,
    );
    const price0050 = await this.fetchOne(
      "TWSE_STOCK_DAY_0050_2025-06",
      TWSE_QUALIFICATION_ENDPOINTS.stockDay0050,
    );
    const price2330 = await this.fetchOne(
      "TWSE_STOCK_DAY_2330_2025-06",
      TWSE_QUALIFICATION_ENDPOINTS.stockDay2330,
    );
    const fetchedAtTimestamp = this.now().toISOString();
    requireCanonicalTimestamp(fetchedAtTimestamp, "fetched_at_timestamp");
    const events = normalizeTwseSplitReferencePayload(split.rawPayload, {
      fetchedAtTimestamp,
      rawPayloadSha256: split.rawPayloadSha256,
    });
    const prices = [
      ...normalizeTwseStockDayPayload(price0050.rawPayload, {
        symbol: "0050",
        datasetIdentifier: "TWSE_STOCK_DAY_0050_2025-06",
        fetchedAtTimestamp,
        sourceAvailabilityTimestamp: price0050.sourceAvailabilityTimestamp,
        rawPayloadSha256: price0050.rawPayloadSha256,
      }),
      ...normalizeTwseStockDayPayload(price2330.rawPayload, {
        symbol: "2330",
        datasetIdentifier: "TWSE_STOCK_DAY_2330_2025-06",
        fetchedAtTimestamp,
        sourceAvailabilityTimestamp: price2330.sourceAvailabilityTimestamp,
        rawPayloadSha256: price2330.rawPayloadSha256,
      }),
    ];
    const fetched = [split, price0050, price2330];
    return {
      executionMode: this.executionMode,
      fetchedAtTimestamp,
      events,
      records: buildNormalizedRecords(events, prices),
      payloadHashes: fetched.map(({ datasetIdentifier, rawPayloadSha256: digest }) => ({
        datasetIdentifier,
        rawPayloadSha256: digest,
      })),
      requestInventory: fetched.map(({ requestInventory }) => requestInventory),
    };
  }
}

function asCommittedSymbol(value: string): "0050" | "2330" | null {
  if (value === "0050" || value === "2330") return value;
  return null;
}

function asCommittedDate(value: string): "2025-06-10" | "2025-06-18" | null {
  if (value === "2025-06-10" || value === "2025-06-18") return value;
  return null;
}

export function parseCommittedQualificationObservations(
  csvInput: string | Buffer,
  expectedInputSha256 = AUTHORIZED_INPUT_SHA256,
): CommittedObservation[] {
  const bytes = typeof csvInput === "string" ? Buffer.from(csvInput, "utf8") : csvInput;
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedInputSha256) {
    fail(
      "COMMITTED_INPUT_SHA256_MISMATCH",
      `expected=${expectedInputSha256}:actual=${actualSha256}`,
    );
  }
  const lines = bytes.toString("utf8").replaceAll("\r\n", "\n").split("\n");
  const header = lines.shift()?.split(",") ?? [];
  const symbolIndex = header.indexOf("symbol");
  const dateIndex = header.indexOf("date");
  const closeIndex = header.indexOf("close");
  if (symbolIndex < 0 || dateIndex < 0 || closeIndex < 0) {
    fail("MISSING_REQUIRED_FIELD", "committed_csv_header");
  }
  const observations: CommittedObservation[] = [];
  for (const [lineIndex, line] of lines.entries()) {
    if (line.trim() === "") continue;
    const fields = line.split(",");
    const symbol = asCommittedSymbol(fields[symbolIndex] ?? "");
    const tradingDate = asCommittedDate(fields[dateIndex] ?? "");
    if (!symbol || !tradingDate) continue;
    observations.push({
      symbol,
      tradingDate,
      rawClose: parseRequiredNumber(fields[closeIndex], `committed_csv[${lineIndex}].close`),
    });
  }
  const expectedKeys = [
    "0050:2025-06-10",
    "0050:2025-06-18",
    "2330:2025-06-10",
    "2330:2025-06-18",
  ];
  const actualKeys = observations.map((record) => `${record.symbol}:${record.tradingDate}`)
    .sort(compareText);
  if (new Set(actualKeys).size !== actualKeys.length) {
    fail("DUPLICATE_RECORD", "committed_observations");
  }
  if (JSON.stringify(actualKeys) !== JSON.stringify([...expectedKeys].sort(compareText))) {
    fail("COMMITTED_OBSERVATION_MISSING", actualKeys.join(","));
  }
  return observations.sort((left, right) =>
    compareText(`${left.symbol}:${left.tradingDate}`, `${right.symbol}:${right.tradingDate}`));
}

export function calculateCloseToCloseReturn(priorClose: number, nextClose: number): number {
  if (!Number.isFinite(priorClose) || priorClose <= 0
    || !Number.isFinite(nextClose) || nextClose <= 0) {
    fail("INVALID_NUMERIC_FIELD", "close_to_close_return");
  }
  return round(nextClose / priorClose - 1);
}

export function classifyPointInTimeStatus(
  evidence: readonly PointInTimeEvidence[],
  asOfTimestamp: string,
): PointInTimeStatus {
  requireCanonicalTimestamp(asOfTimestamp, "as_of_timestamp");
  if (evidence.length === 0) return "PIT_UNPROVEN";
  for (const item of evidence) {
    const timestamp = item.sourcePublicationAvailabilityTimestamp;
    if (!timestamp) continue;
    requireCanonicalTimestamp(timestamp, item.evidenceIdentifier);
    if (timestamp > asOfTimestamp) {
      fail("FUTURE_PUBLICATION_FOR_AS_OF", item.evidenceIdentifier);
    }
  }
  const historicalCount = evidence.filter((item) =>
    item.timestampEvidence === "HISTORICAL_PUBLICATION"
    && item.sourcePublicationAvailabilityTimestamp !== null).length;
  if (historicalCount === evidence.length) return "PIT_PROVEN";
  if (historicalCount > 0) return "PIT_PARTIALLY_PROVEN";
  return "PIT_UNPROVEN";
}

function requiredNormalizedRecord(
  records: readonly NormalizedAdjustedOhlcvRecord[],
  symbol: "0050" | "2330",
  tradingDate: "2025-06-10" | "2025-06-18",
): NormalizedAdjustedOhlcvRecord {
  const matches = records.filter((record) =>
    record.symbol === symbol && record.tradingDate === tradingDate);
  if (matches.length !== 1) {
    fail(
      matches.length === 0 ? "MISSING_REQUIRED_FIELD" : "DUPLICATE_RECORD",
      `normalized:${symbol}:${tradingDate}`,
    );
  }
  return matches[0];
}

function requiredCommittedRecord(
  records: readonly CommittedObservation[],
  symbol: "0050" | "2330",
  tradingDate: "2025-06-10" | "2025-06-18",
): CommittedObservation {
  const matches = records.filter((record) =>
    record.symbol === symbol && record.tradingDate === tradingDate);
  if (matches.length !== 1) {
    fail("COMMITTED_OBSERVATION_MISSING", `${symbol}:${tradingDate}`);
  }
  return matches[0];
}

function assertCommittedMatchesSource(
  committed: CommittedObservation,
  source: NormalizedAdjustedOhlcvRecord,
): void {
  if (committed.rawClose !== source.rawClose) {
    fail(
      "COMMITTED_OBSERVATION_CONFLICT",
      `${committed.symbol}:${committed.tradingDate}:committed=${committed.rawClose}:source=${source.rawClose}`,
    );
  }
}

const SELECTED_DOCUMENTATION = Object.freeze([
  "https://www.twse.com.tw/zh/announcement/split/twtcau.html",
  "https://www.twse.com.tw/en/announcement/split/twtcau.html",
  TWSE_0050_DISCLOSURE.url,
  "https://data.gov.tw/dataset/11549",
  "https://www.twse.com.tw/zh/terms/use.html",
]);

const REMAINING_RISKS = Object.freeze([
  "TWTCAU and STOCK_DAY payloads have no immutable version identifier or historical payload archive reference.",
  "Only the 0050 event has event-specific historical publication evidence; price rows expose current availability only.",
  "Full endpoint retention depth and a numeric rate-limit contract are not documented.",
  "This qualification authorizes neither adjusted-artifact publication nor refitting; raw redistribution remains out of scope.",
]);

function blockedReconciliation(reasons: readonly string[]): ReconciliationResult {
  return {
    status: "BLOCKED",
    priorTradingDate: null,
    nextTradingDate: null,
    committedPriorRawClose: null,
    committedNextRawClose: null,
    sourcePriorRawClose: null,
    sourceNextRawClose: null,
    sourceReferenceAdjustedClose: null,
    derivedAdjustmentFactor: null,
    adjustedPriorClose: null,
    adjustedNextClose: null,
    rawCloseToCloseReturn: null,
    adjustedCloseToCloseReturn: null,
    discontinuityThreshold: EXISTING_PRICE_DISCONTINUITY_THRESHOLD,
    effectiveDate: null,
    corporateActionType: null,
    sourcePublicationAvailabilityTimestamp: null,
    reconciledBelowThreshold: false,
    blockReasons: [...reasons],
  };
}

function blockedControl(reasons: readonly string[]): ControlResult {
  return {
    status: "BLOCKED",
    priorTradingDate: null,
    nextTradingDate: null,
    committedPriorRawClose: null,
    committedNextRawClose: null,
    sourcePriorRawClose: null,
    sourceNextRawClose: null,
    corporateActionReported: false,
    adjustmentFactor: null,
    adjustedCloseToCloseReturn: null,
    fabricatedEvent: false,
    blockReasons: [...reasons],
  };
}

function baseResult(
  executionMode: ExecutionMode,
  status: QualificationStatus,
  pointInTimeStatus: PointInTimeStatus,
  requestInventory: RequestInventoryItem[],
  normalizedRecords: NormalizedAdjustedOhlcvRecord[],
  payloadHashes: PayloadHash[],
  reconciliation: ReconciliationResult,
  control: ControlResult,
  blockReasons: string[],
): QualificationResult {
  return {
    qualificationStatus: status,
    executionMode,
    selectedSource: "TWSE split-reference and STOCK_DAY reports",
    sourceOperator: "Taiwan Stock Exchange Corporation",
    sourceType: "OFFICIAL_EXCHANGE",
    authenticationRequired: false,
    adjustedOhlcvSupported: false,
    corporateActionsSupported: true,
    pointInTimeStatus,
    historicalCoverage:
      "Verified for 0050 and 2330 over 2025-06-10 through 2025-06-18; deeper retention is not asserted.",
    sourceProvenance: {
      candidateEvaluations: SOURCE_CANDIDATE_EVALUATIONS,
      selectedDocumentation: SELECTED_DOCUMENTATION,
      sourceDisclosurePublishedAt: TWSE_0050_DISCLOSURE.publishedAt,
      requestInventory,
      normalizedRecords,
    },
    payloadHashes,
    "0050Reconciliation": reconciliation,
    "2330Control": control,
    remainingRisks: REMAINING_RISKS,
    promotionEligibility: REQUIRED_PROMOTION_ELIGIBILITY,
    credentialsReadOrRequested: false,
    fetchedDataPersisted: false,
    httpMethodsUsed: ["GET"],
    blockReasons,
  };
}

export function qualifyTwseSnapshot(
  snapshot: TwseSourceSnapshot,
  committedObservations: readonly CommittedObservation[],
  asOfTimestamp = snapshot.fetchedAtTimestamp,
): QualificationResult {
  const source0050Prior = requiredNormalizedRecord(
    snapshot.records,
    "0050",
    "2025-06-10",
  );
  const source0050Next = requiredNormalizedRecord(
    snapshot.records,
    "0050",
    "2025-06-18",
  );
  const source2330Prior = requiredNormalizedRecord(
    snapshot.records,
    "2330",
    "2025-06-10",
  );
  const source2330Next = requiredNormalizedRecord(
    snapshot.records,
    "2330",
    "2025-06-18",
  );
  const committed0050Prior = requiredCommittedRecord(
    committedObservations,
    "0050",
    "2025-06-10",
  );
  const committed0050Next = requiredCommittedRecord(
    committedObservations,
    "0050",
    "2025-06-18",
  );
  const committed2330Prior = requiredCommittedRecord(
    committedObservations,
    "2330",
    "2025-06-10",
  );
  const committed2330Next = requiredCommittedRecord(
    committedObservations,
    "2330",
    "2025-06-18",
  );
  [
    [committed0050Prior, source0050Prior],
    [committed0050Next, source0050Next],
    [committed2330Prior, source2330Prior],
    [committed2330Next, source2330Next],
  ].forEach(([committed, source]) => assertCommittedMatchesSource(
    committed as CommittedObservation,
    source as NormalizedAdjustedOhlcvRecord,
  ));

  const matchingEvents = snapshot.events.filter((event) => event.symbol === "0050");
  if (matchingEvents.length !== 1) {
    fail("MISSING_ADJUSTMENT_METADATA", "0050:event_count");
  }
  const event = matchingEvents[0];
  if (event.effectiveDate !== source0050Next.tradingDate
    || event.effectiveDate <= source0050Prior.tradingDate) {
    fail(
      "EVENT_EFFECTIVE_DATE_MISALIGNED",
      `event=${event.effectiveDate}:prior=${source0050Prior.tradingDate}:next=${source0050Next.tradingDate}`,
    );
  }
  if (event.preEventRawClose !== source0050Prior.rawClose) {
    fail(
      "MISSING_ADJUSTMENT_METADATA",
      `event_pre_close=${event.preEventRawClose}:price_pre_close=${source0050Prior.rawClose}`,
    );
  }
  if (source2330Prior.corporateActionType !== null
    || source2330Next.corporateActionType !== null
    || source2330Prior.adjustmentFactor !== 1
    || source2330Next.adjustmentFactor !== 1) {
    fail("CONTROL_SYMBOL_EVENT_REPORTED", "2330");
  }
  const rawReturn = calculateCloseToCloseReturn(
    source0050Prior.rawClose,
    source0050Next.rawClose,
  );
  if (Math.abs(rawReturn) < EXISTING_PRICE_DISCONTINUITY_THRESHOLD) {
    fail("EXPECTED_RAW_DISCONTINUITY_MISSING", String(rawReturn));
  }
  const adjustedReturn = calculateCloseToCloseReturn(
    source0050Prior.adjustedClose,
    source0050Next.adjustedClose,
  );
  if (Math.abs(adjustedReturn) >= EXISTING_PRICE_DISCONTINUITY_THRESHOLD) {
    fail("RECONCILIATION_THRESHOLD_FAILED", String(adjustedReturn));
  }
  const controlReturn = calculateCloseToCloseReturn(
    source2330Prior.adjustedClose,
    source2330Next.adjustedClose,
  );
  const pitEvidence: PointInTimeEvidence[] = [
    ...snapshot.events.map((sourceEvent) => ({
      sourcePublicationAvailabilityTimestamp:
        sourceEvent.sourcePublicationAvailabilityTimestamp,
      timestampEvidence: sourceEvent.timestampEvidence,
      evidenceIdentifier:
        `${sourceEvent.sourceDocumentOrDatasetIdentifier}:${sourceEvent.symbol}`,
    })),
    ...snapshot.records.map((record) => ({
      sourcePublicationAvailabilityTimestamp:
        record.sourcePublicationAvailabilityTimestamp,
      timestampEvidence: record.timestampEvidence,
      evidenceIdentifier:
        `${record.sourceDocumentOrDatasetIdentifier}:${record.symbol}:${record.tradingDate}`,
    })),
  ];
  const pointInTimeStatus = classifyPointInTimeStatus(pitEvidence, asOfTimestamp);
  const reconciliation: ReconciliationResult = {
    status: "RECONCILED",
    priorTradingDate: source0050Prior.tradingDate,
    nextTradingDate: source0050Next.tradingDate,
    committedPriorRawClose: committed0050Prior.rawClose,
    committedNextRawClose: committed0050Next.rawClose,
    sourcePriorRawClose: source0050Prior.rawClose,
    sourceNextRawClose: source0050Next.rawClose,
    sourceReferenceAdjustedClose: event.sourceReferenceAdjustedClose,
    derivedAdjustmentFactor: event.adjustmentFactor,
    adjustedPriorClose: source0050Prior.adjustedClose,
    adjustedNextClose: source0050Next.adjustedClose,
    rawCloseToCloseReturn: rawReturn,
    adjustedCloseToCloseReturn: adjustedReturn,
    discontinuityThreshold: EXISTING_PRICE_DISCONTINUITY_THRESHOLD,
    effectiveDate: event.effectiveDate,
    corporateActionType: event.corporateActionType,
    sourcePublicationAvailabilityTimestamp:
      event.sourcePublicationAvailabilityTimestamp,
    reconciledBelowThreshold: true,
    blockReasons: [],
  };
  const control: ControlResult = {
    status: "PASS",
    priorTradingDate: source2330Prior.tradingDate,
    nextTradingDate: source2330Next.tradingDate,
    committedPriorRawClose: committed2330Prior.rawClose,
    committedNextRawClose: committed2330Next.rawClose,
    sourcePriorRawClose: source2330Prior.rawClose,
    sourceNextRawClose: source2330Next.rawClose,
    corporateActionReported: false,
    adjustmentFactor: 1,
    adjustedCloseToCloseReturn: controlReturn,
    fabricatedEvent: false,
    blockReasons: [],
  };
  return baseResult(
    snapshot.executionMode,
    "PASS",
    pointInTimeStatus,
    [...snapshot.requestInventory],
    [...snapshot.records],
    [...snapshot.payloadHashes],
    reconciliation,
    control,
    [],
  );
}

function deterministicBlockReason(error: unknown): string {
  if (error instanceof AdjustedOhlcvQualificationError) return error.message;
  return "UNEXPECTED_QUALIFICATION_FAILURE";
}

export async function runAdjustedOhlcvSourceQualification(input: {
  adapter: TwseAdjustedOhlcvSourceAdapter;
  committedObservations: readonly CommittedObservation[];
  asOfTimestamp?: string;
  executionMode: ExecutionMode;
}): Promise<QualificationResult> {
  try {
    const snapshot = await input.adapter.fetchSnapshot();
    return qualifyTwseSnapshot(
      snapshot,
      input.committedObservations,
      input.asOfTimestamp ?? snapshot.fetchedAtTimestamp,
    );
  } catch (error: unknown) {
    const reasons = [deterministicBlockReason(error)];
    return baseResult(
      input.executionMode,
      "BLOCKED",
      "PIT_UNPROVEN",
      [],
      [],
      [],
      blockedReconciliation(reasons),
      blockedControl(reasons),
      reasons,
    );
  }
}

export function serializeQualificationResult(result: QualificationResult): string {
  return JSON.stringify(result);
}

const STOCK_DAY_FIELDS = [
  "日期",
  "成交股數",
  "成交金額",
  "開盤價",
  "最高價",
  "最低價",
  "收盤價",
  "漲跌價差",
  "成交筆數",
  "註記",
];

export const TWSE_QUALIFICATION_FIXTURE_PAYLOADS = Object.freeze({
  splitReference: JSON.stringify({
    stat: "OK",
    startDate: "20250618",
    endDate: "20250618",
    title: "ETF分割(反分割)恢復買賣參考價格",
    fields: [
      "恢復買賣日期",
      "ETF代號",
      "名稱",
      "分割(反分割)",
      "停止買賣前收盤價格",
      "恢復買賣參考價",
      "漲停價格",
      "跌停價格",
      "開盤競價基準",
    ],
    data: [[
      "114/06/18",
      "0050",
      "元大台灣50",
      "分割",
      "188.65",
      "47.16",
      "51.85",
      "42.45",
      "47.16",
    ]],
  }),
  stockDay0050: JSON.stringify({
    stat: "OK",
    title: "114年06月 0050 元大台灣50 各日成交資訊",
    fields: STOCK_DAY_FIELDS,
    data: [
      [
        "114/06/10",
        "31,483,080",
        "5,908,431,532",
        "184.90",
        "188.90",
        "184.90",
        "188.65",
        "+4.95",
        "48,271",
        "",
      ],
      [
        "114/06/18",
        "252,639,825",
        "12,002,805,591",
        "47.50",
        "47.72",
        "47.14",
        "47.57",
        "+0.41",
        "197,610",
        "**",
      ],
    ],
  }),
  stockDay2330: JSON.stringify({
    stat: "OK",
    title: "114年06月 2330 台積電 各日成交資訊",
    fields: STOCK_DAY_FIELDS,
    data: [
      [
        "114/06/10",
        "55,353,908",
        "57,406,744,645",
        "1,025.00",
        "1,050.00",
        "1,020.00",
        "1,045.00",
        "+40.00",
        "138,656",
        "",
      ],
      [
        "114/06/18",
        "41,740,374",
        "43,722,320,684",
        "1,040.00",
        "1,055.00",
        "1,030.00",
        "1,055.00",
        "+10.00",
        "45,620",
        "",
      ],
    ],
  }),
});

class FixtureHeaders implements FetchHeadersLike {
  get(name: string): string | null {
    return name.toLowerCase() === "date" ? "Wed, 18 Jun 2025 10:00:00 GMT" : null;
  }
}

export function createTwseQualificationFixtureFetch(
  payloadOverrides: Partial<Record<DatasetIdentifier, string>> = {},
): InjectedFetch {
  const payloadByUrl = new Map<string, { identifier: DatasetIdentifier; payload: string }>([
    [TWSE_QUALIFICATION_ENDPOINTS.splitReference, {
      identifier: "TWSE_TWTCAU_2025-06-18",
      payload: TWSE_QUALIFICATION_FIXTURE_PAYLOADS.splitReference,
    }],
    [TWSE_QUALIFICATION_ENDPOINTS.stockDay0050, {
      identifier: "TWSE_STOCK_DAY_0050_2025-06",
      payload: TWSE_QUALIFICATION_FIXTURE_PAYLOADS.stockDay0050,
    }],
    [TWSE_QUALIFICATION_ENDPOINTS.stockDay2330, {
      identifier: "TWSE_STOCK_DAY_2330_2025-06",
      payload: TWSE_QUALIFICATION_FIXTURE_PAYLOADS.stockDay2330,
    }],
  ]);
  return async (url: string): Promise<FetchResponseLike> => {
    const fixture = payloadByUrl.get(url);
    if (!fixture) throw new Error("fixture URL is outside the qualification allowlist");
    const payload = payloadOverrides[fixture.identifier] ?? fixture.payload;
    return {
      ok: true,
      status: 200,
      headers: new FixtureHeaders(),
      async text(): Promise<string> {
        return payload;
      },
    };
  };
}
