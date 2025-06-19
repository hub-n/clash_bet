import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { PlayerStatistics } from './player-stats/player-stats.entity';
import { Wallets } from './wallets/wallets.entity';
import { Match } from '../services/matches/matches.entity';
import { GameMove } from '../services/games/gamemoves/gamemoves.entity';
import { BalanceState } from 'src/services/balance-state/balance-state.entity';
import { Transaction } from 'src/services/transactions/transactions.entity';
@Entity('USERS')
export class User {
  @PrimaryGeneratedColumn('identity', {
    name: 'USERID',
    generatedIdentity: 'BY DEFAULT',
  })
  UserID: number;

  @Column({ name: 'USERNAME' })
  Username: string;

  @Column({ name: 'EMAIL', unique: true })
  Email: string;

  @Column({ name: 'PASSWORDHASH' })
  PasswordHash: string;

  @CreateDateColumn({ name: 'CREATEDAT' })
  CreatedAt: Date;

  @UpdateDateColumn({ name: 'UPDATEDAT' })
  UpdatedAt: Date;

  @Column({ name: 'USERROLE', default: 'user' })
  UserRole: string;

  @Column({ name: 'USERBIO', default: '' })
  UserBio: string;

  @Column({ name: 'USERFULLNAME', default: '' })
  UserFullName: string;

  @OneToOne(() => PlayerStatistics, (stats) => stats.user, { cascade: true })
  stats: PlayerStatistics;

  @OneToOne(() => Wallets, (wallet) => wallet.user, { cascade: true })
  wallet: Wallets;

  @OneToMany(() => Match, (match) => match.playerOne)
  matchesAsPlayerOne: Match[];

  @OneToMany(() => Match, (match) => match.playerTwo)
  matchesAsPlayerTwo: Match[];

  @OneToMany(() => Match, (match) => match.winner, { nullable: true })
  wonMatches: Match[];

  @OneToMany(() => GameMove, (gameMove) => gameMove.player)
  gameMoves: GameMove[];

  @OneToMany(() => BalanceState, (balanceState) => balanceState.user)
  balanceStates: BalanceState[];
  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];
}
