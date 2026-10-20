const { test } = require('node:test');
const { assertContract, openapi, reportsOpenapi } = require('./contract.cjs');

test('all versioned dashboard examples satisfy the published OpenAPI JSON Schema', () => {
  const examples = openapi.paths['/dashboard'].get.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) assertContract('Dashboard', example.value);
});

test('all versioned reports examples satisfy the published OpenAPI JSON Schema', () => {
  const examples = reportsOpenapi.paths['/reports'].get.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) assertContract('Reports', example.value);
});
