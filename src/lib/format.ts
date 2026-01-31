export function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatConversionRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}
