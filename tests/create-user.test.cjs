const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readNewUser } = require('../dist/database/create-user');

const valid = { ADMIN_EMAIL: ' Person@Example.com ', ADMIN_PASSWORD: 'test-only-password', ADMIN_OPENING_AT: '2026-01-01T00:00:00.000Z' };

test('provisioning normalizes email and defaults to an empty BOB opening', () => {
  const input = readNewUser(valid);
  assert.equal(input.email, 'person@example.com');
  assert.equal(input.openingBalance, '0.00');
  assert.equal(input.openingAt.toISOString(), valid.ADMIN_OPENING_AT);
});

test('provisioning rejects missing credentials, imprecise money and invalid dates', () => {
  for (const override of [
    { ADMIN_EMAIL: '' }, { ADMIN_PASSWORD: 'short' }, { ADMIN_OPENING_BALANCE: '1.001' },
    { ADMIN_OPENING_BALANCE: '1000000000000.00' }, { ADMIN_OPENING_BALANCE: '1e2' },
    { ADMIN_OPENING_AT: '2026-02-30T00:00:00.000Z' }, { ADMIN_OPENING_AT: '9998-01-01T00:00:00.000Z' },
  ]) assert.throws(() => readNewUser({ ...valid, ...override }));
});
