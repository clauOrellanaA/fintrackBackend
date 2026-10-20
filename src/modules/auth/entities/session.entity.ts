import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sessions')
export class Session {
  @PrimaryColumn('varchar', { name: 'token_hash', length: 64 }) tokenHash!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt!: Date;
  @Column('timestamptz', { name: 'revoked_at', nullable: true }) revokedAt!: Date | null;
}
