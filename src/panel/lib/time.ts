const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const dayWithYearFmt = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortDateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : timeFmt.format(date);
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'invalid';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return date.getFullYear() === now.getFullYear()
    ? dayFmt.format(date)
    : dayWithYearFmt.format(date);
}

export function formatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return timeFmt.format(date);
  if (diffDays === 1) return 'Ontem';
  return shortDateFmt.format(date);
}

export function formatDayAndTime(iso: string, now: Date = new Date()): string {
  const label = formatDayLabel(iso, now);
  const time = formatTime(iso);
  if (!label) return time;
  return time ? `${label}, ${time}` : label;
}
