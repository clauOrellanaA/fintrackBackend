import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPersistence1792368000000 implements MigrationInterface {
  name = 'InitialPersistence1792368000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email) AND email <> ''),
        password_hash text NOT NULL,
        opening_balance numeric NOT NULL CHECK (scale(opening_balance) <= 2 AND abs(opening_balance) <= 999999999999.99),
        opening_at timestamptz NOT NULL CHECK (isfinite(opening_at)),
        currency varchar(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB')
      );
      CREATE TABLE sessions (
        token_hash varchar(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);
      CREATE TABLE categories (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id),
        name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
        UNIQUE (id, user_id), UNIQUE (user_id, name)
      );
      CREATE TABLE transactions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id),
        category_id uuid,
        type varchar(7) NOT NULL CHECK (type IN ('income','expense')),
        status varchar(6) NOT NULL CHECK (status IN ('posted','void')),
        amount numeric NOT NULL CHECK (amount > 0 AND amount <= 999999999999.99 AND scale(amount) <= 2),
        currency varchar(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
        occurred_at timestamptz NOT NULL CHECK (isfinite(occurred_at)),
        refund_of_id uuid,
        UNIQUE (id, user_id),
        FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id),
        FOREIGN KEY (refund_of_id, user_id) REFERENCES transactions(id, user_id),
        CHECK (refund_of_id IS NULL OR (type = 'income' AND refund_of_id <> id))
      );
      CREATE INDEX transactions_user_date_idx ON transactions(user_id, occurred_at);
      CREATE FUNCTION validate_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE opened timestamptz; original_type varchar; original_date timestamptz;
      BEGIN
        SELECT opening_at INTO opened FROM users WHERE id = NEW.user_id FOR SHARE;
        IF NEW.occurred_at < opened THEN
          RAISE EXCEPTION 'transaction precedes opening' USING ERRCODE = '23514';
        END IF;
        IF NEW.refund_of_id IS NOT NULL THEN
          SELECT type, occurred_at INTO original_type, original_date FROM transactions
            WHERE id = NEW.refund_of_id AND user_id = NEW.user_id FOR SHARE;
          IF original_type IS DISTINCT FROM 'expense' OR NEW.occurred_at < original_date THEN
            RAISE EXCEPTION 'refund must reference earlier owned expense' USING ERRCODE = '23514';
          END IF;
        END IF;
        IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM transactions WHERE refund_of_id = OLD.id
          AND (NEW.type <> 'expense' OR NEW.user_id <> OLD.user_id OR occurred_at < NEW.occurred_at)) THEN
          RAISE EXCEPTION 'expense incompatible with existing refund' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER transaction_integrity BEFORE INSERT OR UPDATE ON transactions
        FOR EACH ROW EXECUTE FUNCTION validate_transaction();
      CREATE FUNCTION validate_opening() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM transactions WHERE user_id = OLD.id AND occurred_at < NEW.opening_at) THEN
          RAISE EXCEPTION 'opening follows existing transaction' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER opening_integrity BEFORE UPDATE OF opening_at ON users
        FOR EACH ROW EXECUTE FUNCTION validate_opening();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE transactions; DROP TABLE categories; DROP TABLE sessions; DROP TABLE users;
      DROP FUNCTION validate_transaction(); DROP FUNCTION validate_opening();`);
  }
}
