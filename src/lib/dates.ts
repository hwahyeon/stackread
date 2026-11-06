const pad = (n: number) => String(n).padStart(2, "0");

export function dayString(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today in local time; toISOString would give the UTC date. */
export function today(): string {
  const now = new Date();
  return dayString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
