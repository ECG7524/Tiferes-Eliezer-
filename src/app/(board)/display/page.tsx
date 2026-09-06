import { getDisplayData } from '@/lib/displayData';
import { DisplayBoard } from '@/components/DisplayBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * The board for the monitor in shul. Open it full screen on any browser —
 * a smart TV, a Raspberry Pi, an old laptop — and leave it. It refreshes its
 * own data every minute and rolls over at midnight without a reload.
 */
export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const data = await getDisplayData(date);
  return <DisplayBoard initial={data} />;
}
