const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');

const openapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/dashboard.v1.json'), 'utf8'));
const transactionsOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/transactions.v1.json'), 'utf8'));
const budgetsOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/budgets.v1.json'), 'utf8'));
const reportsOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/reports.v1.json'), 'utf8'));
const usersOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/users.v1.json'), 'utf8'));
const savingsGoalsOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/savings-goals.v1.json'), 'utf8'));
const notificationsOpenapi = JSON.parse(readFileSync(join(__dirname, '../docs/openapi/notifications.v1.json'), 'utf8'));
const documents = [openapi, transactionsOpenapi, budgetsOpenapi, reportsOpenapi, usersOpenapi, savingsGoalsOpenapi, notificationsOpenapi];
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validators = new Map();

function assertContract(name, value, specification) {
  const document = specification ?? documents.find(candidate => name in candidate.components.schemas);
  assert.ok(document, `No OpenAPI schema named ${name}.`);
  const key = `${document.info.title}:${name}`;
  if (!validators.has(key)) {
    const definitions = JSON.parse(JSON.stringify(document.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'));
    validators.set(key, ajv.compile({ $defs: definitions, $ref: `#/$defs/${name}` }));
  }
  const validate = validators.get(key);
  assert.ok(validate(value), `${name} violates OpenAPI: ${JSON.stringify(validate.errors)}`);
}

module.exports = { assertContract, openapi, transactionsOpenapi, budgetsOpenapi, reportsOpenapi, usersOpenapi, savingsGoalsOpenapi, notificationsOpenapi };
