import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionDescription1792627200000 implements MigrationInterface {
  name = 'TransactionDescription1792627200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE transactions ADD COLUMN description varchar(500)');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE transactions DROP COLUMN description');
  }
}
