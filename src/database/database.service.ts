import { Injectable, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { readEnvironment } from '../config/environment';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = new Pool({
    connectionString: readEnvironment().databaseUrl,
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    max: 5,
  });

  constructor() {
    this.pool.on('error', () => console.error('Se perdió una conexión inactiva con PostgreSQL.'));
  }

  async check() {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('PostgreSQL no está disponible.');
    }
  }

  async onApplicationShutdown() { await this.pool.end(); }
}
