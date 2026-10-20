import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('savings_entries')
export class SavingsEntry {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'goal_id' }) goalId!: string;
  @Column('varchar', { length: 12 }) type!: 'contribution' | 'withdrawal';
  @Column('numeric') amount!: string;
  @Column('varchar', { length: 3 }) currency!: string;
  @Column('timestamptz', { name: 'occurred_at' }) occurredAt!: Date;
}
