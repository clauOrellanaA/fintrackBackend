const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertContract, openapi, reportsOpenapi, usersOpenapi } = require('./contract.cjs');

test('all versioned dashboard examples satisfy the published OpenAPI JSON Schema', () => {
  const examples = openapi.paths['/dashboard'].get.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) assertContract('Dashboard', example.value);
});

test('all versioned reports examples satisfy the published OpenAPI JSON Schema', () => {
  const examples = reportsOpenapi.paths['/reports'].get.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) assertContract('Reports', example.value);
});

test('user and security request/response examples satisfy the published OpenAPI JSON Schema', () => {
  assertContract('Session', { accessToken: 'opaque-token', tokenType: 'Bearer', expiresAt: '2026-10-19T12:00:00.000Z' });
  assertContract('Profile', { email: 'persona@fintrack.test', displayName: null, openingBalance: '0.00', openingDate: '2026-10-19', currency: 'BOB' });
  assertContract('ProfileUpdate', { displayName: 'Luciana', openingBalance: '100.00' });
  assert.equal(usersOpenapi.paths['/auth/register'].post.responses['201'].description.includes('session'), true);
});

test('savings management request and response schemas are loaded independently from dashboard names', () => {
  const { savingsGoalsOpenapi } = require('./contract.cjs');
  for (const value of [{ name: 'Estudios', target: '3000.00' }, { name: 'Estudios', target: '3000.00', targetDate: null }]) assertContract('CreateGoal', value, savingsGoalsOpenapi);
  assertContract('UpdateGoal', { archived: true, targetDate: null }, savingsGoalsOpenapi);
  assertContract('CreateEntry', { type: 'contribution', amount: '250.00' }, savingsGoalsOpenapi);
  const goal = { id: '00000000-0000-4000-8000-000000000001', name: 'Estudios', target: '3000.00', saved: '250.00', remaining: '2750.00', progress: '8.33', state: 'active', targetDate: null, archived: false, createdAt: '2026-10-30T12:00:00.000Z', currency: 'BOB' };
  assertContract('SavingsGoal', goal, savingsGoalsOpenapi);
  assertContract('EntryResult', { entry: { id: '00000000-0000-4000-8000-000000000002', type: 'contribution', amount: '250.00', currency: 'BOB', occurredAt: '2026-10-30T12:00:00.000Z' }, goal }, savingsGoalsOpenapi);
  const { archived: _archived, ...incomplete } = goal;
  assert.equal(_archived, false);
  assert.throws(() => assertContract('SavingsGoal', incomplete, savingsGoalsOpenapi));
});

test('all versioned notification examples satisfy their published OpenAPI JSON Schema', () => {
  const { notificationsOpenapi } = require('./contract.cjs');
  const examples = notificationsOpenapi.paths['/notifications'].get.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) {
    assertContract('Notifications', example.value, notificationsOpenapi);
    assert.equal(example.value.total, example.value.items.length);
  }
});
