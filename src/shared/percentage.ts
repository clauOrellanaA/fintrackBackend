import { integrityError } from './money';

export function percentageOf(part: bigint, total: bigint): string {
  if (part > total) return integrityError();
  return progressPercentage(part, total);
}

export function progressPercentage(part: bigint, total: bigint): string {
  if (total <= 0n || part < 0n) return integrityError();
  // Hundredths of a percentage point, rounded HALF_UP without floating point.
  const rounded = (part * 20000n + total) / (2n * total);
  return `${rounded / 100n}.${(rounded % 100n).toString().padStart(2, '0')}`;
}
