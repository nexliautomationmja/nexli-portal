export function describeTrend(
  dailyData: { date: string; pageViews: number; uniqueVisitors: number }[]
): string {
  if (dailyData.length < 2) return "Insufficient data for trend analysis";

  const firstHalf = dailyData.slice(0, Math.floor(dailyData.length / 2));
  const secondHalf = dailyData.slice(Math.floor(dailyData.length / 2));

  const avgFirst =
    firstHalf.reduce((s, d) => s + d.pageViews, 0) / firstHalf.length;
  const avgSecond =
    secondHalf.reduce((s, d) => s + d.pageViews, 0) / secondHalf.length;

  if (avgFirst === 0) {
    return avgSecond > 0 ? "New traffic emerging" : "No traffic data";
  }

  const change = ((avgSecond - avgFirst) / avgFirst) * 100;

  if (change > 10)
    return `Upward trend (+${Math.round(change)}% in second half of period)`;
  if (change < -10)
    return `Downward trend (${Math.round(change)}% in second half of period)`;
  return "Stable trend (within +/-10% variation)";
}
