import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/users/users.entity';

@Entity('BALANCESTATE')
export class BalanceState {
  @PrimaryGeneratedColumn('identity', {
    name: 'BALANCESTATEID',
    generatedIdentity: 'BY DEFAULT',
  })
  BalanceStateID: number;

  @Column({ name: 'USERID', type: 'int', nullable: false })
  UserID: number;

  @ManyToOne(() => User, (user) => user.balanceStates)
  @JoinColumn({ name: 'USERID' })
  user: User;

  @Column({ name: 'OPERATION', type: 'decimal', precision: 10, scale: 2 })
  Operation: number;

  @Column({ name: 'FINALBALANCE', type: 'decimal', precision: 6, scale: 2 })
  FinalBalance: number;

  @Column({ name: 'BALANCESTATETIMESTAMP', type: 'timestamp' })
  BalanceStateTimestamp: Date;
}
