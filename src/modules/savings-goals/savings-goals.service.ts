import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { progressPercentage } from '../../shared/percentage';
import { PRODUCT_TIME_ZONE } from '../../shared/product-time';
import { SavingsEntry } from './entities/savings-entry.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SAVINGS_DELTA } from './savings-scope';

interface GoalRow { id: string | null; name: string; target_amount: string; target_date: string | null; created_at: string | null; archived_at: string | null; saved: string }
interface GoalInput { name: string; target: string; targetDate: string | null }
interface GoalUpdate { name?: string; target?: string; targetDate?: string | null; archived?: boolean }
interface EntryInput { type: 'contribution' | 'withdrawal'; amount: string; occurredAt: Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MINOR_UNITS = 99999999999999n;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(record).some(key => !allowed.includes(key))) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'La solicitud contiene campos no permitidos.' } });
  }
}

function requireUserId(userId: string): void {
  if (!UUID.test(userId)) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 100) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'name es obligatorio y debe tener entre 1 y 100 caracteres.' } });
  }
  return value.trim();
}

function normalizeMoney(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe usar formato decimal con dos decimales.` } });
  }
  const minor = decimalToMinorUnits(value);
  if (minor <= 0n) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser positivo.` } });
  if (minor > MAX_MINOR_UNITS) throw new UnprocessableEntityException({ error: { code: 'DATA_OUT_OF_RANGE', message: `${field} excede el rango permitido.` } });
  return value;
}

function normalizeDate(value: unknown, field: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser una fecha YYYY-MM-DD valida.` } });
  }
  const parsed = DateTime.fromISO(value, { zone: PRODUCT_TIME_ZONE });
  if (!parsed.isValid || parsed.toFormat('yyyy-MM-dd') !== value || parsed.year < 1900 || parsed.year > 9998) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser una fecha YYYY-MM-DD valida.` } });
  }
  return value;
}

function normalizeCreate(rawBody: unknown): GoalInput {
  if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
  rejectUnknownKeys(rawBody, ['name', 'target', 'targetDate']);
  return { name: normalizeName(rawBody.name), target: normalizeMoney(rawBody.target, 'target'), targetDate: rawBody.targetDate === undefined ? null : normalizeDate(rawBody.targetDate, 'targetDate', true) };
}

function normalizeUpdate(rawBody: unknown): GoalUpdate {
  if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
  rejectUnknownKeys(rawBody, ['name', 'target', 'targetDate', 'archived']);
  if (Object.keys(rawBody).length === 0) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Debes enviar al menos un cambio.' } });
  const update: GoalUpdate = {};
  if ('name' in rawBody) update.name = normalizeName(rawBody.name);
  if ('target' in rawBody) update.target = normalizeMoney(rawBody.target, 'target');
  if ('targetDate' in rawBody) update.targetDate = normalizeDate(rawBody.targetDate, 'targetDate', true);
  if ('archived' in rawBody) {
    if (typeof rawBody.archived !== 'boolean') throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'archived debe ser booleano.' } });
    update.archived = rawBody.archived;
  }
  return update;
}

function normalizeEntry(rawBody: unknown): EntryInput {
  if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
  rejectUnknownKeys(rawBody, ['type', 'amount', 'occurredAt']);
  if (rawBody.type !== 'contribution' && rawBody.type !== 'withdrawal') throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'type debe ser contribution o withdrawal.' } });
  const amount = normalizeMoney(rawBody.amount, 'amount');
  const occurredAt = rawBody.occurredAt === undefined ? new Date() : normalizeInstant(rawBody.occurredAt);
  return { type: rawBody.type as EntryInput['type'], amount, occurredAt };
}

function normalizeInstant(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'occurredAt debe ser una fecha ISO 8601 valida.' } });
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid || !parsed.toUTC().isValid) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'occurredAt debe ser una fecha ISO 8601 valida.' } });
  return parsed.toUTC().toJSDate();
}

function mapWriteError(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string }).code;
    if (code === '23503') throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Meta de ahorro no encontrada.' } });
    if (code === '23514') throw new ConflictException({ error: { code: 'CONFLICT', message: 'El cambio no es compatible con el historial de la meta.' } });
  }
  throw error;
}

@Injectable()
export class SavingsGoalsService {
  constructor(private readonly persistence: PersistenceService) {}

  async listForUser(userId: string) {
    requireUserId(userId);
    const asOf = new Date();
    return this.persistence.source.transaction('REPEATABLE READ', manager => this.readManageableForUser(userId, asOf, manager));
  }

  async createForUser(userId: string, rawBody: unknown) {
    requireUserId(userId);
    const input = normalizeCreate(rawBody);
    const createdAt = new Date();
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const goal = manager.getRepository(SavingsGoal).create({ id: randomUUID(), userId, name: input.name, target: input.target, currency: 'BOB', createdAt, targetDate: input.targetDate, archivedAt: null, ledgerVersion: '0' });
      try { await manager.getRepository(SavingsGoal).insert(goal); } catch (error) { mapWriteError(error); }
      const goals = await this.readManageableForUser(userId, new Date(), manager);
      return goals.find(item => item.id === goal.id) ?? integrityError();
    });
  }

  async updateForUser(userId: string, id: string, rawBody: unknown) {
    requireUserId(userId);
    const update = normalizeUpdate(rawBody);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const goal = await manager.getRepository(SavingsGoal).findOne({ where: { id, userId } });
      if (!goal) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Meta de ahorro no encontrada.' } });
      if (update.name !== undefined) goal.name = update.name;
      if (update.target !== undefined) goal.target = update.target;
      if (update.targetDate !== undefined) goal.targetDate = update.targetDate;
      if (update.archived !== undefined) goal.archivedAt = update.archived ? new Date() : null;
      try { await manager.getRepository(SavingsGoal).save(goal); } catch (error) { mapWriteError(error); }
      const goals = await this.readManageableForUser(userId, new Date(), manager);
      return goals.find(item => item.id === id) ?? integrityError();
    });
  }

  async addEntryForUser(userId: string, id: string, rawBody: unknown) {
    requireUserId(userId);
    const input = normalizeEntry(rawBody);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const goal = await manager.getRepository(SavingsGoal).findOne({ where: { id, userId } });
      if (!goal) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Meta de ahorro no encontrada.' } });
      const entry = manager.getRepository(SavingsEntry).create({ id: randomUUID(), userId, goalId: id, type: input.type, amount: input.amount, currency: 'BOB', occurredAt: input.occurredAt });
      try { await manager.getRepository(SavingsEntry).insert(entry); } catch (error) { mapWriteError(error); }
      const current = (await this.readManageableForUser(userId, new Date(), manager)).find(item => item.id === id) ?? integrityError();
      return { entry: { id: entry.id, type: entry.type, amount: entry.amount, currency: 'BOB', occurredAt: entry.occurredAt.toISOString() }, goal: current };
    });
  }

  async getForUser(userId: string, asOf: Date, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, asOf, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, asOf, snapshot));
  }

  private async readForUser(userId: string, asOf: Date, manager: EntityManager) {
    const goals = await this.readRows(userId, asOf, manager, false);
    const today = DateTime.fromJSDate(asOf, { zone: PRODUCT_TIME_ZONE }).toISODate();
    if (!today) return integrityError();
    return goals.filter(row => row.id !== null).map(row => this.toDashboardGoal(row, today));
  }

  private async readManageableForUser(userId: string, asOf: Date, manager: EntityManager) {
    const today = DateTime.fromJSDate(asOf, { zone: PRODUCT_TIME_ZONE }).toISODate();
    if (!today) return integrityError();
    return (await this.readRows(userId, asOf, manager, true)).filter(row => row.id !== null).map(row => this.toManageableGoal(row, today));
  }

  private async readRows(userId: string, asOf: Date, manager: EntityManager, includeArchived: boolean): Promise<GoalRow[]> {
    const rows: GoalRow[] = await manager.query(`
      SELECT g.id, g.name, g.target_amount::text AS target_amount,
        TO_CHAR(g.target_date, 'YYYY-MM-DD') AS target_date, g.created_at::text AS created_at,
        g.archived_at::text AS archived_at, COALESCE(SUM(${SAVINGS_DELTA}), 0)::text AS saved
      FROM users u LEFT JOIN savings_goals g ON g.user_id = u.id AND g.currency = u.currency
        AND g.created_at <= $2 AND ($3 = TRUE OR g.archived_at IS NULL OR g.archived_at > $2)
      LEFT JOIN savings_entries e ON e.goal_id = g.id AND e.user_id = u.id AND e.currency = g.currency AND e.occurred_at <= $2
      WHERE u.id = $1 AND u.currency = 'BOB'
      GROUP BY u.id, g.id, g.name, g.target_amount, g.target_date, g.created_at, g.archived_at
      ORDER BY g.created_at ASC, g.id ASC
    `, [userId, asOf, includeArchived]);
    if (rows.length === 0) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    return rows;
  }

  private toDashboardGoal(row: GoalRow, today: string) {
    const goal = this.toManageableGoal(row, today);
    return { id: goal.id, name: goal.name, target: goal.target, saved: goal.saved, remaining: goal.remaining, progress: goal.progress, state: goal.state, targetDate: goal.targetDate };
  }

  private toManageableGoal(row: GoalRow, today: string) {
    if (!row.id || !row.created_at) return integrityError();
    const target = decimalToMinorUnits(row.target_amount);
    const saved = decimalToMinorUnits(row.saved);
    if (target <= 0n || saved < 0n) return integrityError();
    const state = saved >= target ? 'completed' : row.target_date && row.target_date < today ? 'overdue' : 'active';
    return { id: row.id, name: row.name, target: formatMinorUnits(target), saved: formatMinorUnits(saved),
      remaining: formatMinorUnits(saved >= target ? 0n : target - saved), progress: progressPercentage(saved, target), state,
      targetDate: row.target_date, archived: row.archived_at !== null, createdAt: new Date(row.created_at).toISOString(), currency: 'BOB' as const };
  }
}
