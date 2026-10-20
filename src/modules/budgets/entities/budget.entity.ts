import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('budgets')
export class Budget {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'category_id' }) categoryId!: string;
  @Column('varchar', { length: 7 }) month!: string;
  @Column('varchar', { length: 3 }) currency!: string;
  @Column('numeric', { name: 'limit_amount' }) limit!: string;
}
