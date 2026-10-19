import { Injectable } from '@nestjs/common';
import { BalanceService } from '../transactions/balance.service';
import { resolvePeriod } from './period';
import { PersistenceService } from '../../database/persistence.module';
import { MonthlySummaryService } from '../transactions/monthly-summary.service';
import { ExpenseDistributionService } from '../transactions/expense-distribution.service';

@Injectable()
export class DashboardService {
  constructor(private readonly balances: BalanceService, private readonly summaries: MonthlySummaryService, private readonly distributions: ExpenseDistributionService, private readonly persistence: PersistenceService) {}
  async getForUser(userId: string, query: Record<string, unknown>) {
    const asOf = new Date();
    const period = resolvePeriod(query, asOf);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const balance = await this.balances.getForUser(userId, asOf, manager);
      const monthlySummary = await this.summaries.getForUser(userId, period, manager);
      const expenseDistribution = await this.distributions.getForUser(userId, period, manager);
      return {
        period, currency: balance.currency, asOf: asOf.toISOString(),
        sections: {
          balance: { status: 'ready', data: { amount: balance.amount, cutoff: balance.cutoff } }, monthlySummary: { status: 'ready', data: monthlySummary },
          expenseDistribution: { status: 'ready', data: expenseDistribution }, budgets: { status: 'notAvailable' }, savingsGoals: { status: 'notAvailable' },
        },
      };
    });
  }
}
