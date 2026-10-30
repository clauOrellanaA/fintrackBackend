import { integrityError } from '../../shared/money';

export interface BudgetNotificationSource {
  id: string | null;
  categoryName: string;
  limit: string;
  spent: string;
  progress: string;
  state: string;
}

export interface GoalNotificationSource {
  id: string;
  name: string;
  target: string;
  saved: string;
  progress: string;
  state: string;
}

export interface NotificationItem {
  id: string;
  type: 'budget_warning' | 'budget_exceeded' | 'goal_completed' | 'goal_overdue';
  subjectType: 'budget' | 'savingsGoal';
  subjectId: string;
  message: string;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

// Domain services decide state and visibility using their exact financial rules.
// This projection only formats those results; it does not recalculate thresholds.
export function projectNotifications(budgets: readonly BudgetNotificationSource[], goals: readonly GoalNotificationSource[]): NotificationItem[] {
  const items = new Map<string, NotificationItem>();
  const append = (item: NotificationItem) => {
    if (!items.has(item.id)) items.set(item.id, item);
  };
  for (const budget of budgets) {
    if (budget.state !== 'warning' && budget.state !== 'exceeded') continue;
    if (!budget.id) return integrityError();
    const type = budget.state === 'warning' ? 'budget_warning' : 'budget_exceeded';
    const condition = budget.state === 'warning' ? 'está en advertencia' : 'superó el límite';
    append({
      id: type + ':' + budget.id, type, subjectType: 'budget', subjectId: budget.id,
      message: 'El presupuesto de ' + budget.categoryName + ' ' + condition + ': ' + budget.progress + ' % (' + budget.spent + ' de ' + budget.limit + ' BOB).',
    });
  }
  for (const goal of goals) {
    if (goal.state !== 'completed' && goal.state !== 'overdue') continue;
    const type = goal.state === 'completed' ? 'goal_completed' : 'goal_overdue';
    const condition = goal.state === 'completed' ? 'completada' : 'vencida';
    append({
      id: type + ':' + goal.id, type, subjectType: 'savingsGoal', subjectId: goal.id,
      message: 'La meta ' + goal.name + ' está ' + condition + ': ' + goal.saved + ' de ' + goal.target + ' BOB (' + goal.progress + ' %).',
    });
  }
  return [...items.values()].sort((left, right) => compare(left.type, right.type) || compare(left.subjectId, right.subjectId));
}
