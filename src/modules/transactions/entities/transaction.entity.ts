import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'category_id', nullable: true }) categoryId!: string | null;
  @Column('varchar', { length: 7 }) type!: 'income' | 'expense';
  @Column('varchar', { length: 6 }) status!: 'posted' | 'void';
  @Column('numeric') amount!: string;
  @Column('varchar', { length: 3 }) currency!: string;
  @Column('timestamptz', { name: 'occurred_at' }) occurredAt!: Date;
  @Column('varchar', { length: 500, nullable: true }) description!: string | null;
  @Column('uuid', { name: 'refund_of_id', nullable: true }) refundOfId!: string | null;
}
