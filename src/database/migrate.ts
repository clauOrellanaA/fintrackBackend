import 'dotenv/config';
import { createDataSource } from './data-source';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  const source = createDataSource(process.env.DATABASE_URL);
  try {
    await source.initialize();
    const applied = await source.runMigrations();
    console.log(`Migraciones aplicadas: ${applied.length}`);
  } finally { if (source.isInitialized) await source.destroy(); }
}

main().catch(() => { console.error('No se pudieron aplicar migraciones. Revisa PostgreSQL y la configuracion.'); process.exitCode = 1; });
