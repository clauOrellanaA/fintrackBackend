import { InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';

export function integrityError(): never {
  throw new InternalServerErrorException({ error: { code: 'DATA_INTEGRITY_ERROR', message: 'Los datos financieros no son validos.' } });
}

export function decimalToMinorUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return integrityError();
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -minor : minor;
}

export function formatMinorUnits(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  if (absolute > 99999999999999n) {
    throw new UnprocessableEntityException({ error: { code: 'DATA_OUT_OF_RANGE', message: 'El saldo supera el importe permitido.' } });
  }
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
