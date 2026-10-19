// Static expression shared by the visible-goal and all-goal reservation queries.
export const SAVINGS_DELTA = `CASE WHEN e.type = 'contribution' THEN e.amount ELSE -e.amount END`;
