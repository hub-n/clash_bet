import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('TRANSACTIONS')
export class Transaction {
  @PrimaryGeneratedColumn('identity', {
    name: 'TRANSACTIONID',
    generatedIdentity: 'BY DEFAULT',
  })
  TransactionID: number;

  @Column({ name: 'USERID', nullable: false })
  UserID: number;

  @Column({ name: 'AMOUNT' })
  Amount: number;

  @Column({ name: 'TRANSACTIONTYPE' })
  TransactionType: string;

  @Column({ name: 'STATUS' })
  Status: string;

  @CreateDateColumn({ name: 'TRANSACTIONTIMESTAMP' })
  TransactionTimestamp: Date;

  @Column({ name: 'REMARKS' })
  Remarks: string;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'USERID' })
  user: User;
}
