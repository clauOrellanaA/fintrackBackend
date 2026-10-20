export interface MonthlyPeriod { start: string; endExclusive: string }

// Static fragments only; identity and effective bounds are always SQL parameters.
// Both monthly aggregates use the same aliases and $1/$2/$3 parameter ordering.
export const MONTHLY_POSTED_JOIN = `t.user_id = u.id
  AND t.currency = u.currency AND t.status = 'posted'
  AND t.occurred_at >= $2 AND t.occurred_at < $3`;
export const OWNED_BOB_USER = `u.id = $1 AND u.currency = 'BOB'`;
