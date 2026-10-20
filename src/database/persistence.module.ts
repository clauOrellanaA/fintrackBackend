import { Global, Injectable, Module, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { readEnvironment } from '../config/environment';
import { createDataSource } from './data-source';

@Injectable()
export class PersistenceService implements OnModuleInit, OnApplicationShutdown {
  readonly source = createDataSource(readEnvironment().databaseUrl);
  async onModuleInit() {
    try { await this.source.initialize(); }
    catch { throw new Error('No se pudo conectar la persistencia PostgreSQL.'); }
  }
  async onApplicationShutdown() { if (this.source.isInitialized) await this.source.destroy(); }
}

@Global()
@Module({ providers: [PersistenceService], exports: [PersistenceService] })
export class PersistenceModule {}
