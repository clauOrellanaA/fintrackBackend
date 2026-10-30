const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createDataSource } = require('../dist/database/data-source');
const { hashPassword } = require('../dist/modules/auth/password');
const { assertContract } = require('./contract.cjs');

// Each suite owns a new database in the dedicated test instance, never .env.
function isolatedHttp(label) {
  const context = { password: 'isolated-specs-password-only' };
  const database = 'fintrack_specs_' + label + '_' + process.pid + '_' + Date.now();
  let admin;
  context.start = async () => {
    if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL for isolated PostgreSQL integration tests.');
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (url.pathname !== '/fintrack_be01_test') throw Error('TEST_DATABASE_URL must target dedicated fintrack_be01_test database.');
    admin = new Client({ connectionString: url.toString() });
    await admin.connect();
    await admin.query('CREATE DATABASE "' + database + '"');
    url.pathname = '/' + database;
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test';
    context.source = createDataSource(process.env.DATABASE_URL);
    await context.source.initialize();
    await context.source.runMigrations();
    context.passwordHash = await hashPassword(context.password);
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    context.app = await NestFactory.create(AppModule, { logger: false });
    context.app.setGlobalPrefix('api/v1');
    await context.app.listen(0, '127.0.0.1');
    context.base = (await context.app.getUrl()) + '/api/v1';
  };
  context.stop = async () => {
    if (context.app) await context.app.close();
    if (context.source?.isInitialized) await context.source.destroy();
    // Databases remain in the ephemeral test instance until its owner removes it.
    if (admin) await admin.end();
  };
  context.api = (path, token, { method = 'GET', body } = {}) => fetch(context.base + path, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  context.user = async ({ opening = '1000.00', openingAt = '2000-01-01T04:00:00.000Z', displayName = null } = {}) => {
    const id = randomUUID();
    const email = 'specs-' + id + '@fintrack.test';
    await context.source.query("INSERT INTO users(id,email,password_hash,opening_balance,opening_at,currency,display_name) VALUES($1,$2,$3,$4,$5,'BOB',$6)", [id,email,context.passwordHash,opening,openingAt,displayName]);
    const response = await context.api('/auth/login', undefined, { method: 'POST', body: { email, password: context.password } });
    const session = await json(response, 200, 'Session');
    return { id, email, token: session.accessToken };
  };
  return context;
}
async function json(response, status = 200, schema, document) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  if (schema) assertContract(schema, body, document);
  return body;
}
module.exports = { isolatedHttp, json };
