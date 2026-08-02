export function formatBytes(value: unknown) {
  let amount = Number(value ?? 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const decimals = unit < 2 ? 0 : 1;
  return `${amount.toFixed(decimals)} ${units[unit]}`;
}

export function formatRate(value: unknown) {
  return `${formatBytes(value)}/s`;
}

export function formatPercent(used: unknown, total: unknown) {
  const numerator = Number(used ?? 0);
  const denominator = Number(total ?? 0);
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function formatUptime(seconds: unknown) {
  const value = Math.max(0, Number(seconds ?? 0));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
}

export function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function clamp(value: unknown, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value ?? 0)));
}

export function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function asArray<T = Record<string, any>>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
