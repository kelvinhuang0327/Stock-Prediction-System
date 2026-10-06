// Backlog Service
// Adapted from LotteryNew cto_review_tick.py backlog management
// Priority scoring formula: severity*0.35 + impact*0.30 + urgency*0.20 + category*0.15
// Aging: +3 pts per 6 hours, capped at +30

import { prisma } from '@/lib/prisma';
import type {
  BacklogCategory,
  BacklogItemInput,
  BacklogItemRecord,
  BacklogPriorityLevel,
  BacklogSeverity,
  BacklogUrgency,
} from './ctoTypes';
import { AGING_INTERVAL_HOURS, AGING_PTS_MAX, AGING_PTS_PER_INTERVAL } from './ctoTypes';

// ─── Scoring Tables ───────────────────────────────────────────────────────────

const SEVERITY_PTS: Record<BacklogSeverity, number> = {
  CRITICAL: 100,
  HIGH:      75,
  MEDIUM:    50,
  LOW:       25,
};

const URGENCY_PTS: Record<BacklogUrgency, number> = {
  IMMEDIATE: 100,
  SOON:       60,
  ROUTINE:    20,
};

const CATEGORY_WEIGHT: Record<BacklogCategory, number> = {
  signal:    10,
  regime:     8,
  data:       6,
  execution:  4,
};

function computePriorityScore(
  severity: BacklogSeverity,
  impactScore: number,
  urgency: BacklogUrgency,
  category: BacklogCategory,
  createdAt: Date,
  agingBonus: number,
): number {
  const base =
    SEVERITY_PTS[severity]  * 0.35 +
    impactScore              * 0.30 +
    URGENCY_PTS[urgency]     * 0.20 +
    CATEGORY_WEIGHT[category] * 0.15 * 10;

  // Recency bonus for very new items (first 24h)
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const recencyBonus = ageHours <= 3 ? 5 : ageHours <= 7 ? 3 : 0;

  return Math.round((base + recencyBonus + agingBonus) * 10) / 10;
}

function scoreToPriorityLevel(score: number): BacklogPriorityLevel {
  if (score >= 80) return 'P0';
  if (score >= 58) return 'P1';
  if (score >= 35) return 'P2';
  return 'P3';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function insertBacklogItem(input: BacklogItemInput): Promise<BacklogItemRecord> {
  const createdAt = new Date();
  const agingBonus = 0;
  const priorityScore = computePriorityScore(
    input.severity,
    input.impactScore,
    input.urgency,
    input.category,
    createdAt,
    agingBonus,
  );
  const priorityLevel = scoreToPriorityLevel(priorityScore);

  const row = await prisma.ctoBacklogItem.upsert({
    where: { findingId: input.findingId },
    update: {
      severity:       input.severity,
      impactScore:    input.impactScore,
      urgency:        input.urgency,
      category:       input.category,
      suggestedAction: input.suggestedAction ?? null,
      proposalId:     input.proposalId ?? null,
      ctoRunId:       input.ctoRunId ?? null,
      priorityScore,
      priorityLevel,
      status:         'open',
    },
    create: {
      findingId:      input.findingId,
      ctoRunId:       input.ctoRunId ?? null,
      source:         input.source,
      severity:       input.severity,
      impactScore:    input.impactScore,
      urgency:        input.urgency,
      category:       input.category,
      suggestedAction: input.suggestedAction ?? null,
      proposalId:     input.proposalId ?? null,
      status:         'open',
      priorityScore,
      priorityLevel,
      agingBonus,
    },
  });

  return row as BacklogItemRecord;
}

export async function batchInsertBacklogItems(inputs: BacklogItemInput[]): Promise<number> {
  let created = 0;
  for (const input of inputs) {
    await insertBacklogItem(input);
    created++;
  }
  return created;
}

export async function rescoreAllBacklogItems(): Promise<void> {
  const items = await prisma.ctoBacklogItem.findMany({ where: { status: 'open' } });
  const now = Date.now();

  for (const item of items) {
    const ageHours = (now - item.createdAt.getTime()) / (1000 * 60 * 60);
    const intervals = Math.floor(ageHours / AGING_INTERVAL_HOURS);
    const newAgingBonus = Math.min(intervals * AGING_PTS_PER_INTERVAL, AGING_PTS_MAX);

    const newScore = computePriorityScore(
      item.severity as BacklogSeverity,
      item.impactScore,
      item.urgency as BacklogUrgency,
      item.category as BacklogCategory,
      item.createdAt,
      newAgingBonus,
    );

    await prisma.ctoBacklogItem.update({
      where: { id: item.id },
      data: {
        agingBonus:    newAgingBonus,
        priorityScore: newScore,
        priorityLevel: scoreToPriorityLevel(newScore),
      },
    });
  }
}

export async function getPrioritizedBacklog(limit = 50): Promise<BacklogItemRecord[]> {
  await rescoreAllBacklogItems();

  const items = await prisma.ctoBacklogItem.findMany({
    where: { status: 'open' },
    orderBy: { priorityScore: 'desc' },
    take: limit,
  });

  // Assign ranks
  await Promise.all(
    items.map((item, index) =>
      prisma.ctoBacklogItem.update({
        where: { id: item.id },
        data: { rank: index + 1 },
      }),
    ),
  );

  return items as BacklogItemRecord[];
}

export async function getAllBacklogItems(): Promise<BacklogItemRecord[]> {
  return prisma.ctoBacklogItem.findMany({
    orderBy: { priorityScore: 'desc' },
  }) as Promise<BacklogItemRecord[]>;
}

export async function resolveBacklogItem(findingId: string): Promise<void> {
  await prisma.ctoBacklogItem.updateMany({
    where: { findingId },
    data:  { status: 'resolved' },
  });
}

export async function dismissBacklogItem(findingId: string): Promise<void> {
  await prisma.ctoBacklogItem.updateMany({
    where: { findingId },
    data:  { status: 'dismissed' },
  });
}
