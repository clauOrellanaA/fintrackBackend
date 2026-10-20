import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits } from '../../shared/money';
import { BalanceService } from '../transactions/balance.service';
import { ExpenseDistributionService } from '../transactions/expense-distribution.service';
import { MonthlySummaryService } from '../transactions/monthly-summary.service';
import { resolveReportPeriod } from './report-period';

@Injectable()
export class ReportsService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly balances: BalanceService,
    private readonly summaries: MonthlySummaryService,
    private readonly distributions: ExpenseDistributionService,
  ) {}

  async getForUser(userId: string, query: Record<string, unknown>) {
    const asOf = new Date();
    const period = resolveReportPeriod(query);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const comparison = await this.summaries.getForUser(userId, period, manager);
      const income = decimalToMinorUnits(comparison.income);
      const expense = decimalToMinorUnits(comparison.expense);
      const expenseDistribution = await this.distributions.getForUser(userId, period, manager);
      const balanceEvolution: Array<{ month: string; amount: string; cutoff: string }> = [];
      for (const month of period.months) {
        const cutoff = month.endExclusive.getTime() < asOf.getTime() ? month.endExclusive : asOf;
        const balance = await this.balances.getForUser(userId, cutoff, manager);
        balanceEvolution.push({ month: month.month, amount: balance.amount, cutoff: cutoff.toISOString() });
      }
      return {
        period: {
          from: period.from,
          to: period.to,
          timeZone: period.timeZone,
          start: period.start,
          endExclusive: period.endExclusive,
        },
        currency: 'BOB',
        asOf: asOf.toISOString(),
        comparison: { income: comparison.income, expense: comparison.expense, net: formatMinorUnits(income - expense) },
        expenseDistribution,
        balanceEvolution,
      };
    });
  }
}
