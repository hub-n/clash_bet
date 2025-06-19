import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users.entity';

@Entity('WALLETS')
export class Wallets {
  @PrimaryGeneratedColumn('identity', {
    name: 'WALLETID',
    generatedIdentity: 'BY DEFAULT',
  })
  WalletID: number;

  @Column({
    name: 'BALANCE',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  Balance: number;

  @Column({ name: 'USERID' })
  UserID: number;

  @Column({
    name: 'PENDINGBALANCE',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 0,
  })
  PendingBalance: number;

  @CreateDateColumn({ name: 'CREATEDAT' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UPDATEDAT' })
  UpdatedAt: Date;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn({ name: 'USERID' })
  user: User;
}
