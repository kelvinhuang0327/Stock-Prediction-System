/**
 * /api/data/quality - 資料品質報告 API
 */

import { NextResponse } from 'next/server';
import { runQualityCheck } from '@/lib/data/DataQualityChecker';

export async function GET() {
  try {
    const report = await runQualityCheck();
    return NextResponse.json(report);
  } catch (error) {
    console.error('Quality check error:', error);
    return NextResponse.json({ error: '品質檢查失敗' }, { status: 500 });
  }
}
