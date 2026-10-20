const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePeriod } = require('../dist/modules/dashboard/period');

test('period uses product time zone, month/year boundaries and half-open interval', () => {
  const now = new Date('2026-11-01T02:00:00Z');
  assert.deepEqual(resolvePeriod({}, now), { month: '2026-10', timeZone: 'America/La_Paz', start: '2026-10-01T04:00:00.000Z', endExclusive: '2026-11-01T04:00:00.000Z' });
  const december = resolvePeriod({ month: '2026-12' }, now);
  assert.equal(december.endExclusive, '2027-01-01T04:00:00.000Z');
  assert.equal(resolvePeriod({ month: '2024-02' }, now).endExclusive, '2024-03-01T04:00:00.000Z');
  // IANA historical offset must not be replaced with today's fixed UTC-4.
  assert.equal(resolvePeriod({ month: '1900-01' }, now).start, '1900-01-01T04:32:36.000Z');
});

test('period rejects malformed, duplicate, out-of-range and user identity parameters', () => {
  for (const query of [{ month: '' }, { month: '2026-00' }, { month: '2026-13' }, { month: '2026-1' }, { month: '9999-01' }, { month: '1899-12' }, { month: ['2026-01','2026-02'] }, { month: null }, { userId: 'other-user' }]) {
    assert.throws(() => resolvePeriod(query, new Date()), error => error.getStatus() === 400);
  }
});
