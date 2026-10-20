import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Budgets1792454400000 implements MigrationInterface {
  name = 'Budgets1792454400000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE budgets (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      category_id uuid NOT NULL,
      month varchar(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND month >= '1900-01' AND month <= '9998-12'),
      currency varchar(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
      limit_amount numeric NOT NULL CHECK (limit_amount > 0 AND limit_amount <= 999999999999.99 AND scale(limit_amount) <= 2),
      FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id),
      UNIQUE (user_id, category_id, month)
    );`);
  }
  async down(runner: QueryRunner): Promise<void> { await runner.query('DROP TABLE budgets'); }
}
