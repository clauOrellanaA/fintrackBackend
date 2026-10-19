import { Injectable } from '@nestjs/common';
import { BalanceService } from '../transactions/balance.service';
import { resolvePeriod } from './period';

@Injectable()
export class DashboardService {
  constructor(private readonly balances: BalanceService) {}
  async getForUser(userId: string, query: Record<string, unknown>) {
    const asOf = new Date();
    const period = resolvePeriod(query, asOf);
    const balance = await this.balances.getForUser(userId, asOf);
    return {
      period, currency: balance.currency, asOf: asOf.toISOString(),
      sections: {
        balance: { status: 'ready', data: { amount: balance.amount, cutoff: balance.cutoff } }, monthlySummary: { status: 'notAvailable' },
        expenseDistribution: { status: 'notAvailable' }, budgets: { status: 'notAvailable' }, savingsGoals: { status: 'notAvailable' },
      },
    };
  }
}
