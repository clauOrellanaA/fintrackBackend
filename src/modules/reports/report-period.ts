import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PRODUCT_TIME_ZONE } from '../../shared/product-time';

export interface ReportPeriod {
  from: string;
  to: string;
  timeZone: typeof PRODUCT_TIME_ZONE;
  start: string;
  endExclusive: string;
  months: Array<{ month: string; endExclusive: Date }>;
}

export function resolveReportPeriod(query: Record<string, unknown>): ReportPeriod {
  if (Object.keys(query).some(key => key !== 'from' && key !== 'to') || typeof query.from !== 'string' || typeof query.to !== 'string') {
    throw invalidReportPeriod();
  }
  const from = date(query.from);
  const to = date(query.to);
  if (!from || !to || to.toMillis() < from.toMillis()) throw invalidReportPeriod();
  const monthCount = (to.year - from.year) * 12 + to.month - from.month + 1;
  if (monthCount > 24) throw invalidReportPeriod();

  const start = from.startOf('day');
  const endExclusive = to.plus({ days: 1 }).startOf('day');
  const months: Array<{ month: string; endExclusive: Date }> = [];
  for (let cursor = start.startOf('month'); cursor.toMillis() < endExclusive.toMillis(); cursor = cursor.plus({ months: 1 })) {
    months.push({ month: cursor.toFormat('yyyy-MM'), endExclusive: cursor.plus({ months: 1 }).toUTC().toJSDate() });
  }
  return {
    from: query.from,
    to: query.to,
    timeZone: PRODUCT_TIME_ZONE,
    start: start.toUTC().toISO()!,
    endExclusive: endExclusive.toUTC().toISO()!,
    months,
  };
}

function date(value: string): DateTime | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = DateTime.fromISO(value, { zone: PRODUCT_TIME_ZONE });
  if (!parsed.isValid || parsed.toFormat('yyyy-MM-dd') !== value) return undefined;
  const year = parsed.year;
  return year >= 1900 && year <= 9998 ? parsed : undefined;
}

function invalidReportPeriod(): never {
  throw new BadRequestException({ error: { code: 'INVALID_REPORT_PERIOD', message: 'from y to deben formar un rango local valido de hasta 24 meses.' } });
}
