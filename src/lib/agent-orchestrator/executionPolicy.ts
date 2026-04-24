// Execution Policy Service
// Adapted from LotteryNew execution_policy_tick.py
// Modes: strict_priority | balanced | fairness
// Balanced: 70% P0/P1 pool, 30% P2/P3 pool
// Fairness: round-robin with aging-based tiebreaking
// Consecutive category limit enforced across all modes

import { prisma } from '@/lib/prisma';
import type {
  BacklogCategory,
  BacklogItemRecord,
  ExecutionPolicyMode,
} from './ctoTypes';
import { CATEGORY_MAX_CONSECUTIVE, POLICY_HIGH_POOL_RATIO } from './ctoTypes';
import { getPrioritizedBacklog } from './backlogService';

// ─── Selection Algorithms ─────────────────────────────────────────────────────

function enforceConsecutiveLimit(
  items: BacklogItemRecord[],
  lastCategory: BacklogCategory | null,
  consecutiveCount: number,
): BacklogItemRecord[] {
  if (!lastCategory || consecutiveCount < CATEGORY_MAX_CONSECUTIVE) {
    return items;
  }
  // Filter out the saturated category
  const filtered = items.filter((i) => i.category !== lastCategory);
  return filtered.length > 0 ? filtered : items; // fallback to all if no alternatives
}

function selectStrictPriority(
  items: BacklogItemRecord[],
  lastCategory: BacklogCategory | null,
  consecutiveCount: number,
  batchSize: number,
): BacklogItemRecord[] {
  const pool = enforceConsecutiveLimit(items, lastCategory, consecutiveCount);
  return pool.slice(0, batchSize);
}

function selectBalanced(
  items: BacklogItemRecord[],
  lastCategory: BacklogCategory | null,
  consecutiveCount: number,
  batchSize: number,
): BacklogItemRecord[] {
  const highPriority  = items.filter((i) => i.priorityLevel === 'P0' || i.priorityLevel === 'P1');
  const lowPriority   = items.filter((i) => i.priorityLevel === 'P2' || i.priorityLevel === 'P3');

  const highSlots = Math.round(batchSize * POLICY_HIGH_POOL_RATIO);
  const lowSlots  = batchSize - highSlots;

  const highPool = enforceConsecutiveLimit(highPriority, lastCategory, consecutiveCount);
  const lowPool  = enforceConsecutiveLimit(lowPriority,  lastCategory, consecutiveCount);

  const selected = [
    ...highPool.slice(0, highSlots),
    ...lowPool.slice(0, lowSlots),
  ];

  // Fill remaining slots if one pool is smaller than its allocation
  if (selected.length < batchSize) {
    const remaining = items.filter((i) => !selected.includes(i));
    selected.push(...remaining.slice(0, batchSize - selected.length));
  }

  return selected.slice(0, batchSize);
}

function selectFairness(
  items: BacklogItemRecord[],
  lastCategory: BacklogCategory | null,
  consecutiveCount: number,
  batchSize: number,
): BacklogItemRecord[] {
  // Round-robin by category with aging tiebreak
  const categories: BacklogCategory[] = ['signal', 'regime', 'data', 'execution'];
  const byCategory: Record<string, BacklogItemRecord[]> = {};

  for (const cat of categories) {
    byCategory[cat] = items.filter((i) => i.category === cat)
      .sort((a, b) => b.agingBonus - a.agingBonus); // most aged first
  }

  const selected: BacklogItemRecord[] = [];
  let catIndex = 0;

  while (selected.length < batchSize) {
    const cat = categories[catIndex % categories.length];
    const pool = byCategory[cat];

    if (pool && pool.length > 0) {
      const item = pool.shift()!;
      // Respect consecutive limit
      if (
        lastCategory === cat &&
        consecutiveCount >= CATEGORY_MAX_CONSECUTIVE &&
        selected.filter((s) => s.category === cat).length >= CATEGORY_MAX_CONSECUTIVE
      ) {
        catIndex++;
        continue;
      }
      selected.push(item);
    }

    catIndex++;

    // Exit if all pools are drained
    const remaining = categories.reduce((s, c) => s + (byCategory[c]?.length ?? 0), 0);
    if (remaining === 0) break;
  }

  return selected;
}

// ─── Policy State Helpers ─────────────────────────────────────────────────────

async function loadPolicyState(): Promise<{
  mode: ExecutionPolicyMode;
  lastCategory: BacklogCategory | null;
  consecutiveCount: number;
}> {
  const row = await prisma.executionPolicyState.findFirst({
    orderBy: { id: 'desc' },
  });

  return {
    mode:             (row?.mode as ExecutionPolicyMode) ?? 'balanced',
    lastCategory:     (row?.consecutiveCategory as BacklogCategory | null) ?? null,
    consecutiveCount: row?.consecutiveCategoryCount ?? 0,
  };
}

async function updatePolicyState(
  mode: ExecutionPolicyMode,
  selectedItems: BacklogItemRecord[],
): Promise<void> {
  if (selectedItems.length === 0) return;

  // Derive new consecutive count
  const lastCategory = selectedItems[selectedItems.length - 1].category;
  const consecutive  = selectedItems.filter((i) => i.category === lastCategory).length;

  await prisma.executionPolicyState.upsert({
    where:  { id: 1 },
    update: { mode, consecutiveCategory: lastCategory, consecutiveCategoryCount: consecutive, updatedAt: new Date() },
    create: { id: 1, mode, consecutiveCategory: lastCategory, consecutiveCategoryCount: consecutive, updatedAt: new Date() },
  });
}

// ─── Mark Selected ────────────────────────────────────────────────────────────

async function markItemsSelected(items: BacklogItemRecord[]): Promise<void> {
  if (items.length === 0) return;
  await prisma.ctoBacklogItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: {
      status:         'selected',
      lastSelectedAt: new Date(),
      selectionCount: { increment: 1 },
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function selectNextBatch(batchSize = 5): Promise<BacklogItemRecord[]> {
  const [allItems, policyState] = await Promise.all([
    getPrioritizedBacklog(100),
    loadPolicyState(),
  ]);

  const { mode, lastCategory, consecutiveCount } = policyState;

  let selected: BacklogItemRecord[];

  switch (mode) {
    case 'strict_priority':
      selected = selectStrictPriority(allItems, lastCategory, consecutiveCount, batchSize);
      break;
    case 'fairness':
      selected = selectFairness(allItems, lastCategory, consecutiveCount, batchSize);
      break;
    case 'balanced':
    default:
      selected = selectBalanced(allItems, lastCategory, consecutiveCount, batchSize);
  }

  await Promise.all([
    markItemsSelected(selected),
    updatePolicyState(mode, selected),
  ]);

  return selected;
}

export async function getExecutionPolicyMode(): Promise<ExecutionPolicyMode> {
  const { mode } = await loadPolicyState();
  return mode;
}

export async function setExecutionPolicyMode(mode: ExecutionPolicyMode): Promise<void> {
  await prisma.executionPolicyState.upsert({
    where:  { id: 1 },
    update: { mode, updatedAt: new Date() },
    create: { id: 1, mode, consecutiveCategory: null, consecutiveCategoryCount: 0, updatedAt: new Date() },
  });
}
