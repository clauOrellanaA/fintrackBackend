import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { resolvePeriod } from './period';

@Injectable()
export class DashboardService {
  constructor(private readonly users: UsersService) {}
  async getForUser(userId: string, query: Record<string, unknown>) {
    const asOf = new Date();
    const period = resolvePeriod(query, asOf);
    const user = await this.users.requireUser(userId);
    return {
      period, currency: user.currency, asOf: asOf.toISOString(),
      sections: {
        balance: { status: 'notAvailable' }, monthlySummary: { status: 'notAvailable' },
        expenseDistribution: { status: 'notAvailable' }, budgets: { status: 'notAvailable' }, savingsGoals: { status: 'notAvailable' },
      },
    };
  }
}
