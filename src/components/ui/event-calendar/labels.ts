import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function formatVietnameseTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatVietnameseWeekdayShort(date: Date): string {
  return VIETNAMESE_WEEKDAYS[date.getDay()] ?? '';
}

export function formatVietnameseWeekdayLong(date: Date): string {
  return format(date, 'EEEE', { locale: vi });
}

export function formatVietnameseMonthYear(date: Date): string {
  return `Tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

export function formatVietnameseShortDate(date: Date): string {
  return `${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

export function formatVietnameseDate(date: Date): string {
  return `${formatVietnameseWeekdayLong(date)}, ngày ${formatVietnameseShortDate(date)}`;
}

export function formatVietnameseAgendaDate(date: Date): string {
  return `${date.getDate()} tháng ${date.getMonth() + 1}, ${formatVietnameseWeekdayLong(date)}`;
}
