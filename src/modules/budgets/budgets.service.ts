import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { progressPercentage } from '../../shared/percentage';
import { resolvePeriod } from '../dashboard/period';
import { Category } from '../transactions/entities/category.entity';
import { ExpenseDistributionService } from '../transactions/expense-distribution.service';
import { Budget } from './entities/budget.entity';

interface BudgetPeriod { month: string; start: string; endExclusive: string }
interface BudgetRow { id: string | null; category_id: string; category_name: string; limit_amount: string }
interface BudgetInput { categoryId: string; month: string; limit: string }
const MAX_LIMIT_MINOR_UNITS = 99999999999999n;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(record).some(key => !allowed.includes(key))) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'La solicitud contiene campos no permitidos.' } });
  }
}

function requireUserId(userId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
  }
}

function normalizeLimit(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'limit debe usar formato decimal con dos decimales.' } });
  }
  const minorUnits = decimalToMinorUnits(value);
  if (minorUnits <= 0n) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'limit debe ser positivo.' } });
  }
  if (minorUnits > MAX_LIMIT_MINOR_UNITS) {
    throw new UnprocessableEntityException({ error: { code: 'DATA_OUT_OF_RANGE', message: 'limit excede el rango permitido.' } });
  }
  return value;
}

function normalizeCreate(rawBody: unknown): BudgetInput {
  if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
  rejectUnknownKeys(rawBody, ['categoryId', 'month', 'limit']);
  if (typeof rawBody.categoryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBody.categoryId)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'categoryId debe ser un UUID valido.' } });
  }
  if (typeof rawBody.month !== 'string') {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'month es obligatorio.' } });
  }
  resolvePeriod({ month: rawBody.month }, new Date());
  return { categoryId: rawBody.categoryId, month: rawBody.month, limit: normalizeLimit(rawBody.limit) };
}

function mapWriteError(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string }).code;
    if (code === '23505') throw new ConflictException({ error: { code: 'CONFLICT', message: 'Ya existe un presupuesto para esa categoria y ese mes.' } });
    if (code === '23503') throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
  }
  throw error;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly persistence: PersistenceService, private readonly expenses: ExpenseDistributionService) {}

  async listForUser(userId: string, rawQuery: unknown = {}) {
    requireUserId(userId);
    if (!isRecord(rawQuery) || Object.values(rawQuery).some(value => typeof value !== 'string')) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Consulta invalida.' } });
    }
    const period = resolvePeriod(rawQuery, new Date());
    return this.getForUser(userId, period);
  }

  async createForUser(userId: string, rawBody: unknown) {
    requireUserId(userId);
    const input = normalizeCreate(rawBody);
    const period = resolvePeriod({ month: input.month }, new Date());
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const category = await manager.getRepository(Category).findOne({ where: { id: input.categoryId, userId } });
      if (!category) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
      const budget = manager.getRepository(Budget).create({
        id: randomUUID(), userId, categoryId: input.categoryId, month: input.month, currency: 'BOB', limit: input.limit,
      });
      try {
        await manager.getRepository(Budget).insert(budget);
      } catch (error) {
        mapWriteError(error);
      }
      return (await this.readForUser(userId, period, manager)).find(item => item.id === budget.id) ?? integrityError();
    });
  }

  async updateForUser(userId: string, id: string, rawBody: unknown) {
    requireUserId(userId);
    if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
    rejectUnknownKeys(rawBody, ['limit']);
    const limit = normalizeLimit(rawBody.limit);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const budget = await manager.getRepository(Budget).findOne({ where: { id, userId } });
      if (!budget) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado.' } });
      budget.limit = limit;
      try {
        await manager.getRepository(Budget).save(budget);
      } catch (error) {
        mapWriteError(error);
      }
      const period = resolvePeriod({ month: budget.month }, new Date());
      return (await this.readForUser(userId, period, manager)).find(item => item.id === budget.id) ?? integrityError();
    });
  }

  async removeForUser(userId: string, id: string) {
    requireUserId(userId);
    const result = await this.persistence.source.getRepository(Budget).delete({ id, userId });
    if (!result.affected) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado.' } });
  }

  async getForUser(userId: string, period: BudgetPeriod, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, period, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, period, snapshot));
  }

  private async readForUser(userId: string, period: BudgetPeriod, manager: EntityManager) {
    const rows: BudgetRow[] = await manager.query(`
      SELECT b.id, b.category_id, c.name AS category_name, b.limit_amount::text AS limit_amount
      FROM users u LEFT JOIN budgets b ON b.user_id = u.id AND b.month = $2 AND b.currency = u.currency
      LEFT JOIN categories c ON c.id = b.category_id AND c.user_id = u.id
      WHERE u.id = $1 AND u.currency = 'BOB'
      ORDER BY b.category_id ASC, b.id ASC
    `, [userId, period.month]);
    if (rows.length === 0) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    const budgets = rows.filter(row => row.id !== null);
    if (budgets.length === 0) return [];
    const distribution = await this.expenses.getForUser(userId, period, manager);
    const spending = new Map(distribution.filter(row => row.categoryId !== null).map(row => [row.categoryId, decimalToMinorUnits(row.amount)]));
    return budgets.map(row => {
      const limit = decimalToMinorUnits(row.limit_amount);
      if (limit <= 0n || !row.category_id || !row.category_name) return integrityError();
      const spent = spending.get(row.category_id) ?? 0n;
      const state = spent > limit ? 'exceeded' : spent * 100n >= limit * 80n ? 'warning' : 'normal';
      return {
        id: row.id, categoryId: row.category_id, categoryName: row.category_name,
        limit: formatMinorUnits(limit), spent: formatMinorUnits(spent), remaining: formatMinorUnits(limit - spent),
        progress: progressPercentage(spent, limit), state,
      };
    });
  }
}
