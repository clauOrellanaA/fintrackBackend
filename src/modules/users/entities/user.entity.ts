import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn('uuid') id!: string;
  @Column('varchar', { length: 254 }) email!: string;
  @Column('text', { name: 'password_hash', select: false }) passwordHash!: string;
  @Column('numeric', { name: 'opening_balance' }) openingBalance!: string;
  @Column('timestamptz', { name: 'opening_at' }) openingAt!: Date;
  @Column('varchar', { length: 3 }) currency!: string;
}
