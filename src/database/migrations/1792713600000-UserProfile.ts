import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfile1792713600000 implements MigrationInterface {
  name = 'UserProfile1792713600000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE users
        ADD COLUMN display_name varchar(80),
        ADD CONSTRAINT users_display_name_check
          CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 80)
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE users DROP CONSTRAINT users_display_name_check, DROP COLUMN display_name');
  }
}
