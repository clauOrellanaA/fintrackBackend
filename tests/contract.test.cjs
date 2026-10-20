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
