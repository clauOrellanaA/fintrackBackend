import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('varchar', { length: 100 }) name!: string;
}
