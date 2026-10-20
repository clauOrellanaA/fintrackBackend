import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('savings_goals')
export class SavingsGoal {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('varchar', { length: 100 }) name!: string;
  @Column('numeric', { name: 'target_amount' }) target!: string;
  @Column('varchar', { length: 3 }) currency!: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt!: Date;
  @Column('date', { name: 'target_date', nullable: true }) targetDate!: string | null;
  @Column('timestamptz', { name: 'archived_at', nullable: true }) archivedAt!: Date | null;
  @Column('bigint', { name: 'ledger_version' }) ledgerVersion!: string;
}
