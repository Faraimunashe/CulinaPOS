export function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toIsoNow(): string {
  return new Date().toISOString();
}
