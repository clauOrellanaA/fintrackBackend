import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { In, QueryFailedError } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { Category } from './entities/category.entity';
import { Transaction } from './entities/transaction.entity';

const VALID_TYPE = new Set(['income', 'expense']);
const VALID_STATUS = new Set(['posted', 'void']);
const MAX_AMOUNT_MINOR_UNITS = 99999999999999n;

interface TransactionResponse {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  currency: 'BOB';
  categoryId: string | null;
  categoryName: string | null;
  occurredAt: string;
  description: string | null;
  status: 'posted' | 'void';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(record).some(key => !allowed.includes(key))) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'La solicitud contiene campos no permitidos.' } });
  }
}

function normalizeDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser una fecha ISO 8601 valida.` } });
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser una fecha ISO 8601 valida.` } });
  return parsed.toUTC().toJSDate();
}

function normalizeString(value: unknown, field: string, maxLength: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} es obligatorio.` } });
    return null;
  }
  if (typeof value !== 'string') throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser texto.` } });
  const trimmed = value.trim();
  if (required && trimmed.length === 0) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} no puede estar vacio.` } });
  if (trimmed.length > maxLength) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} excede ${maxLength} caracteres.` } });
  return trimmed;
}

function normalizeAmount(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) {
    throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'amount debe usar formato decimal con dos decimales.' } });
  }
  const [whole, fraction] = value.split('.');
  const minorUnits = BigInt(whole) * 100n + BigInt(fraction);
  if (minorUnits <= 0n) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'amount debe ser positivo.' } });
  if (minorUnits > MAX_AMOUNT_MINOR_UNITS) {
    throw new UnprocessableEntityException({ error: { code: 'DATA_OUT_OF_RANGE', message: 'amount excede el rango permitido.' } });
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requireUserId(userId: string): void {
  if (!isUuid(userId)) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
}

function transactionResponse(transaction: Transaction, categoryName: string | null): TransactionResponse {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: 'BOB',
    categoryId: transaction.categoryId,
    categoryName,
    occurredAt: transaction.occurredAt.toISOString(),
    description: transaction.description,
    status: transaction.status,
  };
}

@Injectable()
export class TransactionsService {
  constructor(private readonly persistence: PersistenceService) {}

  async listForUser(userId: string, rawQuery: unknown = {}) {
    requireUserId(userId);
    if (!isRecord(rawQuery)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Consulta invalida.' } });
    rejectUnknownKeys(rawQuery, ['from', 'to', 'type', 'status', 'q', 'page', 'pageSize']);
    if (Object.values(rawQuery).some(value => typeof value !== 'string')) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cada filtro debe aparecer una sola vez como texto.' } });
    }
    const query = rawQuery as Record<string, string>;
    const from = query.from !== undefined ? normalizeDate(query.from, 'from') : undefined;
    const to = query.to !== undefined ? normalizeDate(query.to, 'to') : undefined;
    if (from && to && from >= to) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'from debe ser menor que to.' } });
    const type = typeof query.type === 'string' ? query.type : undefined;
    if (type && !VALID_TYPE.has(type)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'type debe ser income o expense.' } });
    const status = typeof query.status === 'string' ? query.status : 'posted';
    if (status !== 'all' && !VALID_STATUS.has(status)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'status debe ser posted, void o all.' } });
    const parsePage = (value: string | undefined, fallback: number, field: string) => {
      if (value === undefined) return fallback;
      if (!/^\d+$/.test(value)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser un entero valido.` } });
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: `${field} debe ser un entero valido.` } });
      return parsed;
    };
    const page = parsePage(query.page, 1, 'page');
    const pageSize = parsePage(query.pageSize, 20, 'pageSize');
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'page y pageSize deben ser enteros validos.' } });
    }
    const q = typeof query.q === 'string' ? query.q.trim() : undefined;
    if (q && q.length > 100) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'q excede 100 caracteres.' } });
    const builder = this.persistence.source.getRepository(Transaction).createQueryBuilder('transaction');
    builder.where('transaction.user_id = :userId', { userId });
    if (from) builder.andWhere('transaction.occurred_at >= :from', { from });
    if (to) builder.andWhere('transaction.occurred_at < :to', { to });
    if (type) builder.andWhere('transaction.type = :type', { type });
    if (status !== 'all') builder.andWhere('transaction.status = :status', { status });
    if (q) builder.andWhere('(POSITION(:text IN LOWER(COALESCE(transaction.description, \'\'))) > 0 OR POSITION(:text IN LOWER(COALESCE(category.name, \'\'))) > 0)', { text: q.toLowerCase() });
    builder.leftJoin(Category, 'category', 'category.id = transaction.category_id AND category.user_id = transaction.user_id');
    builder.orderBy('transaction.occurredAt', 'DESC');
    builder.addOrderBy('transaction.id', 'DESC');
    const [items, total] = await builder.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    const categoryIds = [...new Set(items.flatMap(item => item.categoryId ? [item.categoryId] : []))];
    const categories = categoryIds.length
      ? await this.persistence.source.getRepository(Category).find({ where: { userId, id: In(categoryIds) } })
      : [];
    const names = new Map(categories.map(category => [category.id, category.name]));
    return {
      items: items.map(item => transactionResponse(item, item.categoryId ? names.get(item.categoryId) ?? null : null)),
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createForUser(userId: string, rawBody: unknown) {
    requireUserId(userId);
    if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
    rejectUnknownKeys(rawBody, ['type', 'amount', 'categoryId', 'occurredAt', 'description']);
    const type = rawBody.type;
    if (type !== 'income' && type !== 'expense') throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'type debe ser income o expense.' } });
    const amount = normalizeAmount(rawBody.amount);
    const occurredAt = normalizeDate(rawBody.occurredAt, 'occurredAt');
    const description = normalizeString(rawBody.description, 'description', 500);
    const categoryId = rawBody.categoryId === undefined || rawBody.categoryId === null
      ? null
      : typeof rawBody.categoryId === 'string' ? rawBody.categoryId
        : (() => { throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'categoryId debe ser UUID o null.' } }); })();
    if (categoryId && !isUuid(categoryId)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'categoryId debe ser un UUID valido.' } });
    const repo = this.persistence.source.getRepository(Transaction);
    const category = categoryId ? await this.persistence.source.getRepository(Category).findOne({ where: { id: categoryId, userId } }) : null;
    if (categoryId && !category) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
    const id = randomUUID();
    const transaction = repo.create({ id, userId, categoryId, type, status: 'posted', amount, currency: 'BOB', occurredAt, description, refundOfId: null });
    await repo.insert(transaction);
    return transactionResponse(transaction, category?.name ?? null);
  }

  async getForUser(userId: string, id: string) {
    requireUserId(userId);
    const item = await this.persistence.source.getRepository(Transaction).findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Movimiento no encontrado.' } });
    const category = item.categoryId ? await this.persistence.source.getRepository(Category).findOne({ where: { id: item.categoryId, userId } }) : null;
    return transactionResponse(item, category?.name ?? null);
  }

  async updateForUser(userId: string, id: string, rawBody: unknown) {
    requireUserId(userId);
    if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
    rejectUnknownKeys(rawBody, ['type', 'amount', 'categoryId', 'occurredAt', 'description']);
    if (Object.keys(rawBody).length === 0) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Debe proporcionar al menos un campo.' } });
    const item = await this.persistence.source.getRepository(Transaction).findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Movimiento no encontrado.' } });
    if (item.status !== 'posted') throw new ConflictException({ error: { code: 'CONFLICT', message: 'No se puede editar un movimiento anulado.' } });
    const next = { ...item };
    if ('type' in rawBody) {
      if (rawBody.type !== 'income' && rawBody.type !== 'expense') throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'type debe ser income o expense.' } });
      next.type = rawBody.type;
    }
    if ('amount' in rawBody && rawBody.amount !== undefined) next.amount = normalizeAmount(rawBody.amount);
    if ('occurredAt' in rawBody) next.occurredAt = normalizeDate(rawBody.occurredAt, 'occurredAt');
    if ('description' in rawBody) next.description = normalizeString(rawBody.description, 'description', 500);
    if ('categoryId' in rawBody) {
      const categoryId = rawBody.categoryId === null ? null : typeof rawBody.categoryId === 'string' ? rawBody.categoryId
        : (() => { throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'categoryId debe ser UUID o null.' } }); })();
      if (categoryId !== null && !isUuid(categoryId)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'categoryId debe ser un UUID valido.' } });
      const category = categoryId ? await this.persistence.source.getRepository(Category).findOne({ where: { id: categoryId, userId } }) : null;
      if (categoryId && !category) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
      next.categoryId = categoryId;
    }
    await this.persistence.source.getRepository(Transaction).save(next);
    const category = next.categoryId ? await this.persistence.source.getRepository(Category).findOne({ where: { id: next.categoryId, userId } }) : null;
    return transactionResponse(next, category?.name ?? null);
  }

  async voidForUser(userId: string, id: string) {
    requireUserId(userId);
    const item = await this.persistence.source.getRepository(Transaction).findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Movimiento no encontrado.' } });
    if (item.status === 'void') return;
    await this.persistence.source.getRepository(Transaction).update({ id, userId }, { status: 'void' });
  }
}

@Injectable()
export class CategoriesService {
  constructor(private readonly persistence: PersistenceService) {}

  async listForUser(userId: string) {
    requireUserId(userId);
    const categories = await this.persistence.source.getRepository(Category).find({ where: { userId }, order: { name: 'ASC', id: 'ASC' } });
    return categories.map(({ id, name }) => ({ id, name }));
  }

  async createForUser(userId: string, rawBody: unknown) {
    requireUserId(userId);
    if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
    rejectUnknownKeys(rawBody, ['name']);
    const name = normalizeString(rawBody.name, 'name', 100, true);
    if (name === null) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'name es obligatorio.' } });
    const repo = this.persistence.source.getRepository(Category);
    const existing = await repo.findOne({ where: { userId, name } });
    if (existing) throw new ConflictException({ error: { code: 'CONFLICT', message: 'Categoria duplicada.' } });
    const category = repo.create({ id: randomUUID(), userId, name });
    try {
      await repo.insert(category);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException({ error: { code: 'CONFLICT', message: 'Categoria duplicada.' } });
      }
      throw error;
    }
    return { id: category.id, name: category.name };
  }

  async updateForUser(userId: string, id: string, rawBody: unknown) {
    requireUserId(userId);
    if (!isRecord(rawBody)) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Cuerpo invalido.' } });
    rejectUnknownKeys(rawBody, ['name']);
    const category = await this.persistence.source.getRepository(Category).findOne({ where: { id, userId } });
    if (!category) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
    const name = normalizeString(rawBody.name, 'name', 100, true);
    if (name === null) throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'name es obligatorio.' } });
    const duplicate = await this.persistence.source.getRepository(Category).findOne({ where: { userId, name } });
    if (duplicate && duplicate.id !== id) throw new ConflictException({ error: { code: 'CONFLICT', message: 'Categoria duplicada.' } });
    category.name = name;
    try {
      await this.persistence.source.getRepository(Category).save(category);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException({ error: { code: 'CONFLICT', message: 'Categoria duplicada.' } });
      }
      throw error;
    }
    return { id: category.id, name: category.name };
  }

  async removeForUser(userId: string, id: string) {
    requireUserId(userId);
    await this.persistence.source.transaction(async manager => {
      const category = await manager.getRepository(Category).findOne({ where: { id, userId } });
      if (!category) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Categoria no encontrada.' } });
      const budgets = await manager.query('SELECT 1 FROM budgets WHERE category_id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
      if (budgets.length > 0) throw new ConflictException({ error: { code: 'CONFLICT', message: 'No se puede eliminar una categoria usada por un presupuesto.' } });
      await manager.getRepository(Transaction).update({ userId, categoryId: id }, { categoryId: null });
      await manager.getRepository(Category).delete({ id, userId });
    });
  }
}
