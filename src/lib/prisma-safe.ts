/**
 * src/lib/prisma-safe.ts
 *
 * Thin wrappers around Prisma models that are sometimes
 * accessed with `(prisma as any).modelName` elsewhere in the codebase.
 *
 * These models are all present in the Prisma schema and fully typed.
 * This module exists solely to centralise the pattern and remove
 * scattered `as any` casts. Do NOT add business logic here.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Re-export typed model delegates for convenient named imports
export const institutionalChipModel = prisma.institutionalChip;
export const notificationDeliveryLogModel = prisma.notificationDeliveryLog;
export const monthlyRevenueModel = prisma.monthlyRevenue;
export const dailyCandidateSnapshotModel = prisma.dailyCandidateSnapshot;

// ── Typed helper return shapes ───────────────────────────────────────────────

export type DeliveryLogRow = {
  channel: string;
  status: string;
  sentAt: Date;
};

export type DeliveryStatusRow = {
  status: string;
};

// ── Safe fallback helpers ────────────────────────────────────────────────────

/**
 * Count rows in institutionalChip; returns 0 on error.
 */
export async function safeChipCount(): Promise<number> {
  try {
    return await prisma.institutionalChip.count();
  } catch {
    return 0;
  }
}

/**
 * Count rows in monthlyRevenue; returns 0 on error.
 */
export async function safeRevenueCount(): Promise<number> {
  try {
    return await prisma.monthlyRevenue.count();
  } catch {
    return 0;
  }
}

/**
 * Fetch last N notification delivery logs ordered by sentAt desc.
 * Returns [] on error (table may not yet be migrated in older envs).
 */
export async function safeDeliveryLogs(take: number): Promise<DeliveryLogRow[]> {
  try {
    return await prisma.notificationDeliveryLog.findMany({
      orderBy: { sentAt: 'desc' },
      take,
      select: { channel: true, status: true, sentAt: true },
    });
  } catch {
    return [];
  }
}

/**
 * Fetch status column for delivery logs after a given ISO timestamp.
 * Returns [] on error.
 */
export async function safeDeliveryStatuses(since: string): Promise<DeliveryStatusRow[]> {
  try {
    return await prisma.notificationDeliveryLog.findMany({
      where: { sentAt: { gte: new Date(since) } },
      select: { status: true },
    });
  } catch {
    return [];
  }
}

/**
 * Fetch the latest DailyCandidateSnapshot for a symbol.
 * Returns null on error.
 */
export async function safeCandidateSnapshotLatest(symbol: string) {
  try {
    return await prisma.dailyCandidateSnapshot.findFirst({
      where: { symbol },
      orderBy: { snapshotDate: 'desc' },
    });
  } catch {
    return null;
  }
}

/**
 * Fetch the last N DailyCandidateSnapshot rows for a symbol.
 * Returns [] on error.
 */
export async function safeCandidateSnapshots(
  symbol: string,
  take: number,
): Promise<Prisma.DailyCandidateSnapshotGetPayload<object>[]> {
  try {
    return await prisma.dailyCandidateSnapshot.findMany({
      where: { symbol },
      orderBy: { snapshotDate: 'desc' },
      take,
    });
  } catch {
    return [];
  }
}
