import { NextResponse } from 'next/server';
import { BUILD_ID } from '@/lib/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Az aktuálisan telepített (éles) build azonosítója — a verzió-figyelőhöz. */
export async function GET() {
  return NextResponse.json({ v: BUILD_ID }, { headers: { 'Cache-Control': 'no-store' } });
}
