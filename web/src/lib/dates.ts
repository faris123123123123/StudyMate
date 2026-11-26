import { id as idLoc, enUS } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const locale = (lang: string) => (lang === 'en' ? enUS : idLoc);
export const fmt = (iso: string | Date, pattern: string, tz: string, lang = 'id') =>
  formatInTimeZone(new Date(iso), tz, pattern, { locale: locale(lang) });
export const dayKey = (d: string | Date, tz: string) => formatInTimeZone(new Date(d), tz, 'yyyy-MM-dd');
/** Nilai untuk <input type="datetime-local"> dalam zona waktu pengguna. */
export const toInput = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd'T'HH:mm");
export const fromInput = (v: string, tz: string) => fromZonedTime(v, tz).toISOString();
export const dayStartIso = (day: string, tz: string) => fromZonedTime(`${day}T00:00:00`, tz).toISOString();

// Aritmetika tanggal berbasis string 'yyyy-MM-dd' (aman dari pergeseran zona waktu)
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const str = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysStr = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return str(d); };
export const startOfWeekStr = (s: string) => addDaysStr(s, -((parse(s).getUTCDay() + 6) % 7)); // Senin
export const startOfMonthStr = (s: string) => `${s.slice(0, 7)}-01`;
export const addMonthsStr = (s: string, n: number) => { const d = parse(startOfMonthStr(s)); d.setUTCMonth(d.getUTCMonth() + n); return str(d); };
export const labelOfDay = (s: string, pattern: string, lang = 'id') => formatInTimeZone(parse(s), 'UTC', pattern, { locale: locale(lang) });

export function relative(iso: string, lang = 'id') {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000), h = Math.round(abs / 3_600_000), d = Math.round(abs / 86_400_000);
  const v = m < 60 ? `${m} ${lang === 'en' ? 'min' : 'menit'}` : h < 48 ? `${h} ${lang === 'en' ? 'h' : 'jam'}` : `${d} ${lang === 'en' ? 'days' : 'hari'}`;
  return diff >= 0 ? (lang === 'en' ? `in ${v}` : `${v} lagi`) : lang === 'en' ? `${v} late` : `terlambat ${v}`;
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
