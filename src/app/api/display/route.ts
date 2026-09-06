import { NextResponse } from 'next/server';
import { getDisplayData } from '@/lib/displayData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** The board re-polls this so the monitor never needs a page reload. */
export async function GET() {
  const data = await getDisplayData();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
