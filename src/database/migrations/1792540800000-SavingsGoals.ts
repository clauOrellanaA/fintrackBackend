import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SavingsGoals1792540800000 implements MigrationInterface {
  name = 'SavingsGoals1792540800000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE savings_goals (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id),
        name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
        target_amount numeric NOT NULL CHECK (target_amount > 0 AND target_amount <= 999999999999.99 AND scale(target_amount) <= 2),
        currency varchar(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
        created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
        target_date date CHECK (isfinite(target_date) AND target_date >= DATE '1900-01-01' AND target_date <= DATE '9998-12-31'),
        archived_at timestamptz CHECK (isfinite(archived_at) AND archived_at >= created_at),
        ledger_version bigint NOT NULL DEFAULT 0,
        UNIQUE (id, user_id)
      );
      CREATE TABLE savings_entries (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id),
        goal_id uuid NOT NULL,
        type varchar(12) NOT NULL CHECK (type IN ('contribution','withdrawal')),
        amount numeric NOT NULL CHECK (amount > 0 AND amount <= 999999999999.99 AND scale(amount) <= 2),
        currency varchar(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
        occurred_at timestamptz NOT NULL CHECK (isfinite(occurred_at)),
        FOREIGN KEY (goal_id, user_id) REFERENCES savings_goals(id, user_id)
      );
      CREATE INDEX savings_goals_owner_idx ON savings_goals(user_id);
      CREATE INDEX savings_entries_goal_date_idx ON savings_entries(goal_id, occurred_at);
      CREATE FUNCTION validate_savings_goal() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE opened timestamptz;
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at) THEN
          RAISE EXCEPTION 'goal identity and creation are immutable' USING ERRCODE = '23514';
        END IF;
        SELECT opening_at INTO opened FROM users WHERE id = NEW.user_id FOR SHARE;
        IF NEW.created_at < opened THEN
          RAISE EXCEPTION 'goal precedes opening' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER savings_goal_integrity BEFORE INSERT OR UPDATE OF id, user_id, created_at ON savings_goals
        FOR EACH ROW EXECUTE FUNCTION validate_savings_goal();
      CREATE FUNCTION validate_savings_entry() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE created timestamptz; minimum_balance numeric;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          RAISE EXCEPTION 'savings ledger is append only' USING ERRCODE = '23514';
        END IF;
        -- Version bump serializes writers; stale REPEATABLE READ writers must retry,
        -- instead of validating withdrawals against a snapshot missing a committed entry.
        UPDATE savings_goals SET ledger_version = ledger_version + 1
          WHERE id = NEW.goal_id AND user_id = NEW.user_id RETURNING created_at INTO created;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'owned goal required' USING ERRCODE = '23503';
        END IF;
        IF NEW.occurred_at < created THEN
          RAISE EXCEPTION 'entry precedes goal creation' USING ERRCODE = '23514';
        END IF;
        SELECT MIN(balance) INTO minimum_balance FROM (
          SELECT SUM(delta) OVER (ORDER BY occurred_at) AS balance FROM (
            SELECT occurred_at, SUM(delta) AS delta FROM (
              SELECT occurred_at, CASE WHEN type = 'contribution' THEN amount ELSE -amount END AS delta
              FROM savings_entries WHERE goal_id = NEW.goal_id
              UNION ALL SELECT NEW.occurred_at, CASE WHEN NEW.type = 'contribution' THEN NEW.amount ELSE -NEW.amount END
            ) entries GROUP BY occurred_at
          ) instants
        ) running;
        IF minimum_balance < 0 THEN
          RAISE EXCEPTION 'withdrawal exceeds effective accumulated savings' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER savings_entry_integrity BEFORE INSERT OR UPDATE OR DELETE ON savings_entries
        FOR EACH ROW EXECUTE FUNCTION validate_savings_entry();
      CREATE OR REPLACE FUNCTION validate_opening() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM transactions WHERE user_id = OLD.id AND occurred_at < NEW.opening_at)
          OR EXISTS (SELECT 1 FROM savings_goals WHERE user_id = OLD.id AND created_at < NEW.opening_at) THEN
          RAISE EXCEPTION 'opening follows existing financial history' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE OR REPLACE FUNCTION validate_opening() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM transactions WHERE user_id = OLD.id AND occurred_at < NEW.opening_at) THEN
          RAISE EXCEPTION 'opening follows existing transaction' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      DROP TABLE savings_entries; DROP TABLE savings_goals;
      DROP FUNCTION validate_savings_entry(); DROP FUNCTION validate_savings_goal();
    `);
  }
}
