const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');

const openapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/dashboard.v1.json'), 'utf8'));
const definitions = JSON.parse(JSON.stringify(openapi.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'));
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validators = new Map();

function assertContract(name, value) {
  if (!validators.has(name)) validators.set(name, ajv.compile({ $defs: definitions, $ref: `#/$defs/${name}` }));
  const validate = validators.get(name);
  assert.ok(validate(value), `${name} violates OpenAPI: ${JSON.stringify(validate.errors)}`);
}

module.exports = { assertContract, openapi };
