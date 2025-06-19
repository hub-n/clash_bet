import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users.entity';

@Entity('PLAYERSTATISTICS')
export class PlayerStatistics {
  @PrimaryGeneratedColumn('identity', {
    name: 'STATID',
    generatedIdentity: 'BY DEFAULT',
  })
  StatID: number;

  @Column({ name: 'USERID' })
  UserID: number;

  @Column({ name: 'WINS', default: 0 })
  Wins: number;

  @Column({ name: 'LOSSES', default: 0 })
  Losses: number;

  @Column({ name: 'DRAWS', default: 0 })
  Draws: number;

  @Column({
    name: 'WINRATE',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  WinRate: number;

  @Column({ name: 'CURRENTSTREAK', default: 0 })
  CurrentStreak: number;

  @Column({ name: 'ELORATING', type: 'decimal', default: 1000 })
  EloRating: number;

  @Column({
    name: 'LASTUPDATED',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  LastUpdated: Date;

  @OneToOne(() => User, (user) => user.stats)
  @JoinColumn({ name: 'USERID' })
  user: User;
}
