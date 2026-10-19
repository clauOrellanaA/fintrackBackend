import { createHash } from 'node:crypto';

export function demoId(userId: string, label: string, namespace = 'fintrack-be05'): string {
  const hex = createHash('sha256').update(`${namespace}:${userId}:${label}`).digest('hex');
  // Custom deterministic UUIDv8: identifiers only, not credentials.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
