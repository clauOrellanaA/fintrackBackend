import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export const PRODUCT_TIME_ZONE = 'America/La_Paz';

export function resolvePeriod(query: Record<string, unknown>, asOf: Date) {
  if (Object.keys(query).some(key => key !== 'month') || (query.month !== undefined && typeof query.month !== 'string')) {
    throw invalidPeriod();
  }
  const month = query.month ?? DateTime.fromJSDate(asOf, { zone: PRODUCT_TIME_ZONE }).toFormat('yyyy-MM');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900 || Number(month.slice(0, 4)) > 9998) throw invalidPeriod();
  const start = DateTime.fromISO(`${month}-01`, { zone: PRODUCT_TIME_ZONE });
  if (!start.isValid) throw invalidPeriod();
  return { month, timeZone: PRODUCT_TIME_ZONE, start: start.toUTC().toISO()!, endExclusive: start.plus({ months: 1 }).toUTC().toISO()! };
}

function invalidPeriod() {
  return new BadRequestException({ error: { code: 'INVALID_PERIOD', message: 'month debe tener formato YYYY-MM y un mes valido.' } });
}
